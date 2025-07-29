import { useCallback } from "react";
import type {
  StreamResponse,
  SDKMessage,
  SystemMessage,
  AbortMessage,
  OrchestrationMessage,
  ExecutionStep,
} from "../../types";
import {
  isSystemMessage,
  isAssistantMessage,
  isResultMessage,
  isUserMessage,
} from "../../utils/messageTypes";
import { useMessageConverter } from "../useMessageConverter";
import type { StreamingContext } from "./useMessageProcessor";
import { useToolHandling } from "./useToolHandling";
import { generateId } from "../../utils/id";

export function useStreamParser() {
  const {
    createSystemMessage,
    createToolMessage,
    createResultMessage,
    createToolResultMessage,
  } = useMessageConverter();

  const { toolUseCache, processToolResult } = useToolHandling();

  const handleSystemMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "system" }>,
      context: StreamingContext,
    ) => {
      // Check if this is an init message and if we should show it
      if (claudeData.subtype === "init") {
        // Mark that we've received init
        context.setHasReceivedInit?.(true);

        const shouldShow = context.shouldShowInitMessage?.() ?? true;
        if (shouldShow) {
          const systemMessage = createSystemMessage(claudeData);
          context.addMessage(systemMessage);
          context.onInitMessageShown?.();
        }
      } else {
        // Always show non-init system messages
        const systemMessage = createSystemMessage(claudeData);
        context.addMessage(systemMessage);
      }
    },
    [createSystemMessage],
  );

  const handleAssistantTextMessage = useCallback(
    (contentItem: { text?: string }, context: StreamingContext) => {
      let messageToUpdate = context.currentAssistantMessage;

      if (!messageToUpdate) {
        messageToUpdate = {
          type: "chat",
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          agentId: context.agentId, // Set agent ID for response attribution
        };
        context.setCurrentAssistantMessage(messageToUpdate);
        context.addMessage(messageToUpdate);
      }

      const updatedContent =
        (messageToUpdate.content || "") + (contentItem.text || "");

      // Update the current assistant message state
      const updatedMessage = {
        ...messageToUpdate,
        content: updatedContent,
      };
      context.setCurrentAssistantMessage(updatedMessage);
      context.updateLastMessage(updatedContent);
    },
    [],
  );

  const handleToolUseMessage = useCallback(
    (
      contentItem: {
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      },
      context: StreamingContext,
    ) => {
      // Check if this is an orchestration tool response
      if (contentItem.name === "orchestrate_execution" && contentItem.input) {
        const steps = contentItem.input.steps as any[];
        if (Array.isArray(steps)) {
          // Create orchestration message with execution steps
          const orchestrationSteps: ExecutionStep[] = steps.map((step) => ({
            id: step.id || generateId(),
            agent: step.agent,
            message: step.message,
            status: "pending" as const,
            timestamp: Date.now(),
            dependencies: step.dependencies || [],
          }));

          const orchestrationMessage: OrchestrationMessage = {
            type: "orchestration",
            steps: orchestrationSteps,
            timestamp: Date.now(),
          };

          context.addMessage(orchestrationMessage);
          return;
        }
      }

      // Cache tool_use information for later permission error handling
      if (contentItem.id && contentItem.name) {
        toolUseCache.set(
          contentItem.id,
          contentItem.name,
          contentItem.input || {},
        );
      }

      const toolMessage = createToolMessage(contentItem);
      context.addMessage(toolMessage);
    },
    [createToolMessage, toolUseCache],
  );

  const handleAssistantMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "assistant" }>,
      context: StreamingContext,
    ) => {
      for (const contentItem of claudeData.message.content) {
        if (contentItem.type === "text") {
          handleAssistantTextMessage(contentItem, context);
        } else if (contentItem.type === "tool_use") {
          handleToolUseMessage(contentItem as any, context);
        }
      }
    },
    [handleAssistantTextMessage, handleToolUseMessage],
  );

  const handleResultMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "result" }>,
      context: StreamingContext,
    ) => {
      const resultMessage = createResultMessage(claudeData);
      context.addMessage(resultMessage);
      context.setCurrentAssistantMessage(null);
    },
    [createResultMessage],
  );

  const handleUserMessage = useCallback(
    (
      claudeData: Extract<SDKMessage, { type: "user" }>,
      context: StreamingContext,
    ) => {
      // Check if this user message contains tool_result content
      const messageContent = claudeData.message.content;

      if (Array.isArray(messageContent)) {
        for (const contentItem of messageContent) {
          if (contentItem.type === "tool_result") {
            // Check if this is an orchestration tool result
            if (contentItem.tool_use_id && typeof contentItem.content === "string") {
              try {
                // Try to parse the tool result content as JSON for orchestration
                const parsed = JSON.parse(contentItem.content);
                if (parsed.steps && Array.isArray(parsed.steps)) {
                  // This is an orchestration response
                  const orchestrationSteps: ExecutionStep[] = parsed.steps.map((step: any) => ({
                    id: step.id || generateId(),
                    agent: step.agent,
                    message: step.message,
                    status: "pending" as const,
                    timestamp: Date.now(),
                    dependencies: step.dependencies || [],
                  }));

                  const orchestrationMessage: OrchestrationMessage = {
                    type: "orchestration",
                    steps: orchestrationSteps,
                    timestamp: Date.now(),
                  };

                  context.addMessage(orchestrationMessage);
                  continue; // Skip regular tool result processing
                }
              } catch (e) {
                // Not JSON or not orchestration data, fall through to regular processing
              }
            }
            
            // Regular tool result processing
            processToolResult(contentItem as any, context, createToolResultMessage);
          }
        }
      }
      // Note: We don't display regular user messages from the SDK as they represent Claude's internal tool results
    },
    [createToolResultMessage, processToolResult],
  );

  const processClaudeData = useCallback(
    (claudeData: SDKMessage, context: StreamingContext) => {
      // Update sessionId only for the first assistant message after init
      if (
        claudeData.type === "assistant" &&
        context.hasReceivedInit &&
        claudeData.session_id &&
        context.onSessionId
      ) {
        context.onSessionId(claudeData.session_id);
      }

      switch (claudeData.type) {
        case "system":
          if (isSystemMessage(claudeData)) {
            handleSystemMessage(claudeData, context);
          } else {
            console.warn("Invalid system message:", claudeData);
          }
          break;
        case "assistant":
          if (isAssistantMessage(claudeData)) {
            handleAssistantMessage(claudeData, context);
          } else {
            console.warn("Invalid assistant message:", claudeData);
          }
          break;
        case "result":
          if (isResultMessage(claudeData)) {
            handleResultMessage(claudeData, context);
          } else {
            console.warn("Invalid result message:", claudeData);
          }
          break;
        case "user":
          if (isUserMessage(claudeData)) {
            handleUserMessage(claudeData, context);
          } else {
            console.warn("Invalid user message:", claudeData);
          }
          break;
        default:
          console.log("Unknown Claude message type:", claudeData);
      }
    },
    [
      handleSystemMessage,
      handleAssistantMessage,
      handleResultMessage,
      handleUserMessage,
    ],
  );

  const processStreamLine = useCallback(
    (line: string, context: StreamingContext) => {
      try {
        // Skip empty lines and flush markers (just whitespace)
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          return;
        }

        const data: StreamResponse = JSON.parse(line);

        if (data.type === "claude_json" && data.data) {
          // data.data is already an SDKMessage object, no need to parse
          const claudeData = data.data as SDKMessage;
          processClaudeData(claudeData, context);
        } else if (data.type === "error") {
          const errorMessage: SystemMessage = {
            type: "error",
            subtype: "stream_error",
            message: data.error || "Unknown error",
            timestamp: Date.now(),
          };
          context.addMessage(errorMessage);
          context.setCurrentAssistantMessage(null);
          context.onRequestComplete?.();
        } else if (data.type === "aborted") {
          const abortedMessage: AbortMessage = {
            type: "system",
            subtype: "abort",
            message: "Operation was aborted by user",
            timestamp: Date.now(),
          };
          context.addMessage(abortedMessage);
          context.setCurrentAssistantMessage(null);
          context.onRequestComplete?.();
        } else if (data.type === "done") {
          // Request completed successfully - clean up current assistant message and signal completion
          context.setCurrentAssistantMessage(null);
          context.onRequestComplete?.();
        }
      } catch (parseError) {
        // Don't log errors for flush markers (empty lines)
        if (line.trim()) {
          console.error("Failed to parse stream line:", parseError);
        }
      }
    },
    [processClaudeData],
  );

  return {
    processStreamLine,
  };
}
