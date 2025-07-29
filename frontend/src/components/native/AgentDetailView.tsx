import { Copy, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import type { ChatRequest, ChatMessage, ExecutionStep } from "../../types";
import { useAgentConfig } from "../../hooks/useAgentConfig";
import { useTheme } from "../../hooks/useTheme";
import { useClaudeStreaming } from "../../hooks/useClaudeStreaming";
import { usePermissions } from "../../hooks/chat/usePermissions";
import { useAbortController } from "../../hooks/chat/useAbortController";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "../chat/ChatMessages";
import { PermissionDialog } from "../PermissionDialog";
import { getChatUrl } from "../../config/api";
import type { StreamingContext } from "../../hooks/streaming/useMessageProcessor";
import { debugStreamingConnection, debugStreamingChunk, debugStreamingPerformance, warnProxyBuffering } from "../../utils/streamingDebug";

interface AgentDetailViewProps {
  agentId: string;
  // Chat state from parent
  agentSessions: Record<string, any>;
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  hasReceivedInit: boolean;
  hasShownInitMessage: boolean;
  currentAssistantMessage: any;
  // Chat state setters
  setInput: (value: string) => void;
  setCurrentSessionId: (sessionId: string | null, useAgentRoom: boolean) => void;
  setHasReceivedInit: (value: boolean) => void;
  setHasShownInitMessage: (value: boolean) => void;
  setCurrentAssistantMessage: (message: any) => void;
  addMessage: (msg: any, useAgentRoom: boolean) => void;
  updateLastMessage: (content: string, useAgentRoom: boolean) => void;
  clearInput: () => void;
  generateRequestId: () => string;
  resetRequestState: () => void;
  startRequest: () => void;
  // Helper functions
  switchToAgent: (agentId: string) => void;
  getOrCreateAgentSession: (agentId: string) => any;
}

const getAgentColor = (agentId: string) => {
  // Generate consistent colors based on agent ID
  const colors = [
    "#3b82f6", // blue
    "#ef4444", // red  
    "#10b981", // green
    "#f59e0b", // yellow
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
  ];
  
  // Create a simple hash from the agent ID
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export function AgentDetailView({ 
  agentId,
  // agentSessions, // Not used directly
  input,
  isLoading,
  currentRequestId,
  hasReceivedInit,
  hasShownInitMessage,
  currentAssistantMessage,
  setInput,
  setCurrentSessionId,
  setHasReceivedInit,
  setHasShownInitMessage,
  setCurrentAssistantMessage,
  addMessage,
  updateLastMessage,
  clearInput,
  generateRequestId,
  resetRequestState,
  startRequest,
  switchToAgent,
  getOrCreateAgentSession,
}: AgentDetailViewProps) {
  const { getAgentById, config } = useAgentConfig();
  const agent = getAgentById(agentId);
  const [showConfig, setShowConfig] = useState(false);
  
  useTheme(); // For theme switching support
  const { processStreamLine } = useClaudeStreaming();
  const { abortRequest, createAbortHandler } = useAbortController();

  // Switch to this agent when component mounts
  useEffect(() => {
    switchToAgent(agentId);
  }, [agentId, switchToAgent]);

  // Get agent-specific session data
  const agentSession = getOrCreateAgentSession(agentId);
  const currentAgentMessages = agentSession.messages;
  const agentSessionId = agentSession.sessionId;

  const {
    permissionDialog,
    closePermissionDialog,
  } = usePermissions();

  // Handle abort functionality
  const handleAbort = useCallback(() => {
    if (currentRequestId) {
      abortRequest(currentRequestId, isLoading, resetRequestState);
    }
  }, [currentRequestId, isLoading, abortRequest, resetRequestState]);

  // Handle sending messages with streaming
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    const messageContent = input.trim();
    const requestId = generateRequestId();
    
    // Add user message
    const userMessage: ChatMessage = {
      type: "chat",
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
      agentId: agentId,
    };
    addMessage(userMessage, false); // false = not group mode

    clearInput();
    startRequest();

    // Set up streaming context
    const streamingContext: StreamingContext = {
      hasReceivedInit,
      currentAssistantMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      onSessionId: (sessionId) => setCurrentSessionId(sessionId, false),
      addMessage: (msg) => addMessage(msg, false),
      updateLastMessage: (content) => updateLastMessage(content, false),
      onRequestComplete: () => resetRequestState(),
      shouldShowInitMessage: () => !hasShownInitMessage,
      onInitMessageShown: () => setHasShownInitMessage(true),
      agentId: agentId, // Pass agent ID for response attribution
    };

    try {
      if (!agent) {
        console.log("❌ CRITICAL ERROR - Agent not found for ID:", agentId);
        return;
      }

      const chatRequest: ChatRequest = {
        message: messageContent,
        sessionId: agentSessionId || undefined,
        requestId,
        workingDirectory: agent.workingDirectory,
        availableAgents: config.agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          workingDirectory: agent.workingDirectory,
          apiEndpoint: agent.apiEndpoint,
          isOrchestrator: agent.isOrchestrator
        })),
      };

      const requestStartTime = Date.now();
      const targetApiEndpoint = agent.apiEndpoint;
      const finalUrl = getChatUrl(targetApiEndpoint);
      
      debugStreamingConnection(finalUrl, { "Content-Type": "application/json" });

      const response = await fetch(finalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      createAbortHandler(requestId);

      let streamingDetected = false;
      let lastResponseTime = Date.now();
      const streamingTimeout = 30000; // 30 seconds

      // Set up streaming detection timeout
      const streamingCheck = setTimeout(() => {
        if (!streamingDetected) {
          warnProxyBuffering(streamingTimeout);
          // Add a system message to inform user
          addMessage({
            type: "system",
            subtype: "warning",
            message: "Streaming may be affected by network configuration. Responses may appear delayed.",
            timestamp: Date.now(),
          }, false);
        }
      }, streamingTimeout);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        debugStreamingChunk(chunk, lines.length);

        for (const line of lines) {
          if (line.trim()) {
            if (!streamingDetected && Date.now() - lastResponseTime < 5000) {
              streamingDetected = true;
              clearTimeout(streamingCheck);
              debugStreamingPerformance(requestStartTime, Date.now());
            }
            processStreamLine(line, streamingContext);
            lastResponseTime = Date.now();
          }
        }
      }

      clearTimeout(streamingCheck);
    } catch (error: any) {
      console.error("Chat error:", error);
      if (error.name !== "AbortError") {
        addMessage({
          type: "error",
          subtype: "stream_error",
          message: `Error: ${error.message}`,
          timestamp: Date.now(),
        }, false);
      }
      resetRequestState();
    }
  }, [
    input,
    isLoading,
    agentId,
    agentSessionId,
    hasReceivedInit,
    hasShownInitMessage,
    currentAssistantMessage,
    generateRequestId,
    addMessage,
    clearInput,
    startRequest,
    setHasReceivedInit,
    setHasShownInitMessage,
    setCurrentAssistantMessage,
    setCurrentSessionId,
    updateLastMessage,
    resetRequestState,
    processStreamLine,
    createAbortHandler,
    agent,
    config,
  ]);

  // Handle execution of individual steps from orchestration plans
  const handleExecuteStep = useCallback(async (step: ExecutionStep) => {
    if (step.status !== "pending") return;

    const targetAgent = getAgentById(step.agent);
    if (!targetAgent) {
      console.error(`Agent not found: ${step.agent}`);
      return;
    }

    const requestId = generateRequestId();
    
    const userMessage: ChatMessage = {
      type: "chat",
      role: "user", 
      content: step.message,
      timestamp: Date.now(),
      agentId: step.agent,
    };

    addMessage(userMessage, false);
    startRequest();

    const streamingContext: StreamingContext = {
      hasReceivedInit,
      currentAssistantMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      onSessionId: (sessionId) => setCurrentSessionId(sessionId, false),
      addMessage: (msg) => addMessage(msg, false),
      updateLastMessage: (content) => updateLastMessage(content, false),
      onRequestComplete: () => resetRequestState(),
      shouldShowInitMessage: () => !hasShownInitMessage,
      onInitMessageShown: () => setHasShownInitMessage(true),
      agentId: step.agent, // Pass agent ID for step execution
    };

    try {
      const chatRequest: ChatRequest = {
        message: step.message,
        sessionId: agentSessionId || undefined,
        requestId,
        workingDirectory: targetAgent.workingDirectory,
        availableAgents: config.agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          workingDirectory: agent.workingDirectory,
          apiEndpoint: agent.apiEndpoint,
          isOrchestrator: agent.isOrchestrator
        })),
      };

      const requestStartTime = Date.now();
      const stepTargetApiEndpoint = targetAgent.apiEndpoint;
      debugStreamingConnection(getChatUrl(stepTargetApiEndpoint), { "Content-Type": "application/json" });

      const response = await fetch(getChatUrl(stepTargetApiEndpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      createAbortHandler(requestId);

      let streamingDetected = false;
      let lastResponseTime = Date.now();
      const streamingTimeout = 30000; // 30 seconds

      // Set up streaming detection timeout
      const streamingCheck = setTimeout(() => {
        if (!streamingDetected) {
          warnProxyBuffering(streamingTimeout);
          // Add a system message to inform user
          addMessage({
            type: "system",
            subtype: "warning",
            message: "Streaming may be affected by network configuration. Responses may appear delayed.",
            timestamp: Date.now(),
          }, false);
        }
      }, streamingTimeout);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        debugStreamingChunk(chunk, lines.length);

        for (const line of lines) {
          if (line.trim()) {
            if (!streamingDetected && Date.now() - lastResponseTime < 5000) {
              streamingDetected = true;
              clearTimeout(streamingCheck);
              debugStreamingPerformance(requestStartTime, Date.now());
            }
            processStreamLine(line, streamingContext);
            lastResponseTime = Date.now();
          }
        }
      }

      clearTimeout(streamingCheck);
    } catch (error: any) {
      console.error("Step execution error:", error);
      if (error.name !== "AbortError") {
        addMessage({
          type: "error",
          subtype: "stream_error",
          message: `Error executing step: ${error.message}`,
          timestamp: Date.now(),
        }, false);
      }
      resetRequestState();
    }
  }, [
    generateRequestId,
    addMessage,
    startRequest,
    hasReceivedInit,
    hasShownInitMessage,
    currentAssistantMessage,
    setHasReceivedInit,
    setHasShownInitMessage,
    setCurrentAssistantMessage,
    setCurrentSessionId,
    updateLastMessage,
    agentSessionId,
    processStreamLine,
    createAbortHandler,
    resetRequestState,
    getAgentById,
    config,
  ]);

  // Handle automatic execution of entire orchestration plan
  const handleExecutePlan = useCallback(async (steps: ExecutionStep[]) => {
    console.log("Executing plan with", steps.length, "steps");
    
    // Execute steps respecting dependencies
    const executeStepsRecursively = async (remainingSteps: ExecutionStep[]) => {
      if (remainingSteps.length === 0) return;
      
      // Find steps that can be executed (no pending dependencies)
      const executableSteps = remainingSteps.filter(step => {
        if (step.status !== "pending") return false;
        
        // Check if all dependencies are completed
        const dependencies = step.dependencies || [];
        return dependencies.every(depId => {
          const depStep = steps.find(s => s.id === depId);
          return depStep?.status === "completed";
        });
      });
      
      if (executableSteps.length === 0) {
        console.log("No more executable steps found");
        return;
      }
      
      // Execute all executable steps in parallel
      console.log(`Executing ${executableSteps.length} steps:`, executableSteps.map(s => s.id));
      
      const promises = executableSteps.map(async (step) => {
        try {
          await handleExecuteStep(step);
          // Mark step as completed (in a real implementation, this would be done by the execution response)
          step.status = "completed";
        } catch (error) {
          console.error(`Failed to execute step ${step.id}:`, error);
          step.status = "failed";
        }
      });
      
      await Promise.all(promises);
      
      // Continue with remaining steps
      const stillPending = remainingSteps.filter(step => step.status === "pending");
      if (stillPending.length > 0) {
        // Small delay before next batch
        await new Promise(resolve => setTimeout(resolve, 1000));
        await executeStepsRecursively(stillPending);
      }
    };
    
    await executeStepsRecursively(steps);
    console.log("Plan execution completed");
  }, [handleExecuteStep]);
  
  if (!agent) {
    return (
      <div className="agent-detail">
        <div className="agent-detail-content">
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <h3>Agent Not Found</h3>
            <p>The requested agent could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  // Use agent-specific messages
  const agentMessages = currentAgentMessages;
  
  const lastActivity = agentMessages.length > 0 
    ? new Date(agentMessages[agentMessages.length - 1].timestamp).toLocaleString()
    : "No activity yet";

  // Determine agent status
  const isActive = agentSessionId !== null;
  const status = isActive ? "Active" : "Idle";

  const agentColor = getAgentColor(agent.id);

  const copyPath = () => {
    navigator.clipboard.writeText(agent.workingDirectory);
  };

  return (
    <div className="agent-detail" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="agent-detail-content" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Agent Header with Configuration */}
        <div className="agent-detail-header" style={{ flexShrink: 0 }}>
          <div 
            className="agent-detail-icon"
            style={{ backgroundColor: agentColor }}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="agent-detail-info" style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h1 style={{ margin: 0 }}>{agent.name}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div 
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: isActive ? "#10b981" : "#6b7280"
                    }}
                  />
                  <span style={{
                    fontSize: "12px",
                    color: isActive ? "#10b981" : "#6b7280",
                    fontWeight: 500
                  }}>
                    {status}
                  </span>
                  <span style={{
                    fontSize: "12px",
                    color: "var(--claude-text-muted)"
                  }}>
                    • {agentMessages.length} messages
                  </span>
                </div>
              </div>
              
              {/* Configuration Toggle */}
              <button
                onClick={() => setShowConfig(!showConfig)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--claude-text-muted)",
                  borderRadius: "4px",
                  transition: "background-color 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--claude-border)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {showConfig ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Config
              </button>
            </div>
            
            <p style={{ margin: "4px 0 0 0", color: "var(--claude-text-secondary)" }}>
              {agent.description}
            </p>
            
            {/* Collapsible Configuration */}
            {showConfig && (
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "8px",
                marginTop: "12px",
                padding: "12px",
                background: "var(--claude-border)",
                borderRadius: "6px",
                fontSize: "12px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--claude-text-secondary)", fontWeight: 500 }}>Agent ID</span>
                  <code 
                    style={{
                      background: "var(--claude-main-bg)",
                      padding: "3px 6px",
                      borderRadius: "3px",
                      fontFamily: "'SF Mono', Monaco, monospace",
                      border: "1px solid var(--claude-border)"
                    }}
                  >
                    {agent.id}
                  </code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ color: "var(--claude-text-secondary)", fontWeight: 500 }}>Working Directory</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", maxWidth: "60%" }}>
                    <code 
                      style={{
                        background: "var(--claude-main-bg)",
                        padding: "3px 6px",
                        borderRadius: "3px",
                        fontFamily: "'SF Mono', Monaco, monospace",
                        border: "1px solid var(--claude-border)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {agent.workingDirectory}
                    </code>
                    <button 
                      onClick={copyPath} 
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "3px",
                        color: "var(--claude-text-muted)",
                        borderRadius: "3px"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--claude-main-bg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--claude-text-secondary)", fontWeight: 500 }}>API Endpoint</span>
                  <code 
                    style={{
                      background: "var(--claude-main-bg)",
                      padding: "3px 6px",
                      borderRadius: "3px",
                      fontFamily: "'SF Mono', Monaco, monospace",
                      border: "1px solid var(--claude-border)",
                      maxWidth: "60%",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {agent.apiEndpoint}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message History - Main Content with Streaming */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <h2 style={{ 
            fontSize: "16px", 
            fontWeight: 600, 
            margin: "24px 0 16px 0",
            color: "var(--claude-text-primary)",
            flexShrink: 0
          }}>
            Conversation
            {agentMessages.length > 0 && (
              <span style={{
                fontSize: "12px",
                fontWeight: 400,
                color: "var(--claude-text-muted)",
                marginLeft: "8px"
              }}>
                Last activity: {lastActivity}
              </span>
            )}
          </h2>
          
          {/* Messages container that allows ChatMessages to handle its own scrolling */}
          <div className="messages-container" style={{ flex: 1, minHeight: 0 }}>
            <ChatMessages
              messages={agentMessages}
              isLoading={isLoading}
              onExecuteStep={handleExecuteStep}
              onExecutePlan={handleExecutePlan}
              currentAgentId={agentId}
            />
          </div>
        </div>

      </div>
      
      {/* Chat Input */}
      <div style={{ borderTop: "1px solid var(--claude-border)" }}>
        <ChatInput
          input={input}
          isLoading={isLoading}
          currentRequestId={currentRequestId}
          activeAgentId={agentId}
          currentMode="agent"
          lastUsedAgentId={null}
          onInputChange={setInput}
          onSubmit={handleSendMessage}
          onAbort={handleAbort}
        />
      </div>

      {/* Permission Dialog */}
      {permissionDialog && (
        <PermissionDialog
          {...permissionDialog}
          onAllow={() => closePermissionDialog()}
          onAllowPermanent={() => closePermissionDialog()}
          onDeny={() => closePermissionDialog()}
          onClose={closePermissionDialog}
        />
      )}
    </div>
  );
}