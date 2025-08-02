import { useState, useEffect, useCallback } from "react";
import type { AllMessage, TimestampedSDKMessage } from "../types";
import type { ConversationHistory } from "../../../shared/types";
import { getConversationUrl } from "../config/api";
import { useMessageConverter } from "./useMessageConverter";
import { useAgentConfig } from "./useAgentConfig";
import { useRemoteAgentHistory } from "./useRemoteAgentHistory";

interface HistoryLoaderState {
  messages: AllMessage[];
  loading: boolean;
  error: string | null;
  sessionId: string | null;
}

interface HistoryLoaderResult extends HistoryLoaderState {
  loadHistory: (projectPath: string, sessionId: string, agentId?: string) => Promise<void>;
  clearHistory: () => void;
}

// Type guard to check if a message is a TimestampedSDKMessage
function isTimestampedSDKMessage(
  message: unknown,
): message is TimestampedSDKMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    "timestamp" in message &&
    typeof (message as { timestamp: unknown }).timestamp === "string"
  );
}

/**
 * Hook for loading and converting conversation history from the backend
 */
export function useHistoryLoader(): HistoryLoaderResult {
  const [state, setState] = useState<HistoryLoaderState>({
    messages: [],
    loading: false,
    error: null,
    sessionId: null,
  });

  const { convertConversationHistory } = useMessageConverter();
  const { getOrchestratorAgent, agents } = useAgentConfig();
  const remoteHistory = useRemoteAgentHistory();

  const loadHistory = useCallback(
    async (encodedProjectName: string, sessionId: string, agentId?: string) => {
      if (!encodedProjectName || !sessionId) {
        setState((prev) => ({
          ...prev,
          error: "Encoded project name and session ID are required",
        }));
        return;
      }

      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
        }));

        let conversationHistory: ConversationHistory;

        if (agentId && agentId !== "local") {
          // Load from remote agent
          const agent = agents.find(a => a.id === agentId);
          if (!agent) {
            throw new Error(`Agent with ID ${agentId} not found`);
          }
          
          conversationHistory = await remoteHistory.fetchAgentConversation(
            agent.apiEndpoint,
            encodedProjectName,
            sessionId
          );
        } else {
          // Load from local orchestrator
          const orchestratorAgent = getOrchestratorAgent();
          const response = await fetch(
            getConversationUrl(encodedProjectName, sessionId, orchestratorAgent?.apiEndpoint),
          );

          if (!response.ok) {
            throw new Error(
              `Failed to load conversation: ${response.status} ${response.statusText}`,
            );
          }

          conversationHistory = await response.json();
        }

        // Validate the response structure
        if (
          !conversationHistory.messages ||
          !Array.isArray(conversationHistory.messages)
        ) {
          throw new Error("Invalid conversation history format");
        }

        // Convert unknown[] to TimestampedSDKMessage[] with type checking
        const timestampedMessages: TimestampedSDKMessage[] = [];
        for (const msg of conversationHistory.messages) {
          if (isTimestampedSDKMessage(msg)) {
            timestampedMessages.push(msg);
          } else {
            console.warn("Skipping invalid message in history:", msg);
          }
        }

        // Convert to frontend message format
        const convertedMessages =
          convertConversationHistory(timestampedMessages);

        setState((prev) => ({
          ...prev,
          messages: convertedMessages,
          loading: false,
          sessionId: conversationHistory.sessionId,
        }));
      } catch (error) {
        console.error("Error loading conversation history:", error);

        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load conversation history",
        }));
      }
    },
    [convertConversationHistory, agents, remoteHistory, getOrchestratorAgent],
  );

  const clearHistory = useCallback(() => {
    setState({
      messages: [],
      loading: false,
      error: null,
      sessionId: null,
    });
  }, []);

  return {
    ...state,
    loadHistory,
    clearHistory,
  };
}

/**
 * Hook for loading conversation history on mount when sessionId is provided
 */
export function useAutoHistoryLoader(
  encodedProjectName?: string,
  sessionId?: string,
  agentId?: string,
): HistoryLoaderResult {
  const historyLoader = useHistoryLoader();

  useEffect(() => {
    if (encodedProjectName && sessionId) {
      historyLoader.loadHistory(encodedProjectName, sessionId, agentId);
    } else if (!sessionId) {
      // Only clear if there's no sessionId - don't clear while waiting for encodedProjectName
      historyLoader.clearHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encodedProjectName, sessionId, agentId]);

  return historyLoader;
}
