import { Copy, ChevronDown, ChevronRight, History, MessageSquare } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import type { ChatRequest, ChatMessage, ExecutionStep } from "../../types";
import type { ConversationSummary } from "../../../../shared/types";
import { useAgentConfig } from "../../hooks/useAgentConfig";
import { useTheme } from "../../hooks/useTheme";
import { useClaudeStreaming } from "../../hooks/useClaudeStreaming";
import { usePermissions } from "../../hooks/chat/usePermissions";
import { useAbortController } from "../../hooks/chat/useAbortController";
import { useRemoteAgentHistory } from "../../hooks/useRemoteAgentHistory";
import { useHistoryLoader } from "../../hooks/useHistoryLoader";
import { useMessageConverter } from "../../hooks/useMessageConverter";
import { useClaudeAuth } from "../../hooks/useClaudeAuth";
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
  loadHistoricalMessages: (messages: any[], sessionId: string, agentId?: string, useAgentRoom?: boolean) => void;
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
  loadHistoricalMessages,
}: AgentDetailViewProps) {
  const { getAgentById, config } = useAgentConfig();
  const agent = getAgentById(agentId);
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [hasAttemptedHistoryLoad, setHasAttemptedHistoryLoad] = useState(false);
  
  useTheme(); // For theme switching support
  const { processStreamLine } = useClaudeStreaming();
  const { abortRequest, createAbortHandler } = useAbortController();
  const remoteHistory = useRemoteAgentHistory();
  const historyLoader = useHistoryLoader();
  const { convertConversationHistory } = useMessageConverter();
  const { session: claudeSession } = useClaudeAuth();

  // Switch to this agent when component mounts
  useEffect(() => {
    switchToAgent(agentId);
  }, [agentId, switchToAgent]);

  // Load conversation history for this agent
  const loadAgentHistory = useCallback(async () => {
    if (!agent || hasAttemptedHistoryLoad) {
      return;
    }

    try {
      setHistoryLoading(true);
      setHistoryError(null);
      setHasAttemptedHistoryLoad(true);

      console.log(`📚 Loading history for agent: ${agent.name} (${agent.id})`);

      // Get projects for this specific agent
      const agentProjects = await remoteHistory.fetchAgentProjects(agent.apiEndpoint);
      console.log(`📁 Found ${agentProjects.length} projects for agent ${agent.name}`);
      
      // Collect all conversations from all projects for this agent
      // Backend will filter by agent ID, so no need for fragile keyword matching
      const allAgentConversations: ConversationSummary[] = [];
      
      for (const project of agentProjects) {
        try {
          console.log(`📖 Loading conversations from project: ${project.path}`);
          const projectHistories = await remoteHistory.fetchAgentHistories(
            agent.apiEndpoint, 
            project.encodedName,
            agent.id // Pass agent ID for filtering
          );
          console.log(`💬 Found ${projectHistories.length} conversations in project ${project.path}`);
          allAgentConversations.push(...projectHistories);
        } catch (projectError) {
          console.warn(`Failed to load project ${project.path} for agent ${agent.name}:`, projectError);
        }
      }
      
      // Sort conversations by start time (newest first)
      allAgentConversations.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      
      setConversations(allAgentConversations);
      console.log(`✅ Loaded ${allAgentConversations.length} total conversations for agent ${agent.name}`);
      
    } catch (err) {
      console.error("❌ Failed to load agent conversations:", err);
      setHistoryError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setHistoryLoading(false);
    }
  }, [agent, remoteHistory, hasAttemptedHistoryLoad]);

  // Handle conversation selection from history
  const handleHistoryConversationSelect = useCallback(async (sessionId: string) => {
    try {
      if (!agent) return;

      // Show loading state while conversation is being loaded
      setHistoryLoading(true);
      setHistoryError(null);

      // Try to find the conversation in all agent projects
      let foundProject = null;
      
      try {
        const agentProjects = await remoteHistory.fetchAgentProjects(agent.apiEndpoint);
        
        console.log(`🔍 Searching for session ${sessionId} in ${agentProjects.length} projects`);
        
        // Try each project until we find one with this session
        for (const project of agentProjects) {
          try {
            const conversation = await remoteHistory.fetchAgentConversation(
              agent.apiEndpoint,
              project.encodedName,
              sessionId
            );
            if (conversation) {
              foundProject = project.encodedName;
              console.log(`✅ Found session in project: ${project.path}`);
              break;
            }
          } catch {
            // Continue searching in other projects
          }
        }
      } catch (error) {
        console.warn("Could not search agent projects for session:", error);
      }
      
      // Continue if no project found
      if (!foundProject) {
        console.warn("No matching project found for conversation");
        setHistoryError("Could not find the project for this conversation");
        return;
      }
      
      // Get the conversation directly from remote agent
      console.log(`🔍 Loading conversation ${sessionId} from project ${foundProject}`);
      
      const conversation = await remoteHistory.fetchAgentConversation(
        agent.apiEndpoint,
        foundProject,
        sessionId
      );
      
      if (conversation && conversation.messages && conversation.messages.length > 0) {
        console.log("📚 Loading historical conversation:", {
          sessionId,
          agentId,
          messageCount: conversation.messages.length,
        });

        // Convert the conversation to frontend message format
        const convertedMessages = convertConversationHistory(conversation.messages as any);

        // Load messages into the agent's session
        loadHistoricalMessages(convertedMessages, sessionId, agentId, false);
        
        // Switch back to Current Chat tab to show the loaded conversation
        setShowHistory(false);
        
        // Clear any history errors
        setHistoryError(null);
        
        console.log("✅ Historical conversation loaded successfully");
      } else {
        console.warn("⚠️ No messages found in historical conversation");
        setHistoryError("No messages found in this conversation");
      }
    } catch (error) {
      console.error("❌ Failed to load conversation:", error);
      setHistoryError(error instanceof Error ? error.message : "Failed to load conversation");
    } finally {
      setHistoryLoading(false);
    }
  }, [agent, remoteHistory, historyLoader, agentId, loadHistoricalMessages]);

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

      // Debug OAuth authentication state
      console.log("🔐 [AUTH DEBUG] OAuth session state:", claudeSession ? "✅ AUTHENTICATED" : "❌ NOT AUTHENTICATED");
      if (claudeSession) {
        console.log("🔐 [AUTH DEBUG] OAuth user:", claudeSession.account?.email_address);
        console.log("🔐 [AUTH DEBUG] OAuth expires:", new Date(claudeSession.expiresAt).toISOString());
        console.log("🔐 [AUTH DEBUG] Including claudeAuth in request");
      } else {
        console.log("🔐 [AUTH DEBUG] No OAuth session - request will use system credentials");
      }

      const chatRequest: ChatRequest = {
        message: messageContent,
        sessionId: agentSessionId || undefined,
        requestId,
        workingDirectory: agent.workingDirectory,
        claudeAuth: claudeSession ? {
          accessToken: claudeSession.accessToken,
          refreshToken: claudeSession.refreshToken,
          expiresAt: claudeSession.expiresAt,
          userId: claudeSession.userId,
          subscriptionType: claudeSession.subscriptionType,
          account: claudeSession.account
        } : undefined,
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
    claudeSession,
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
        claudeAuth: claudeSession ? {
          accessToken: claudeSession.accessToken,
          refreshToken: claudeSession.refreshToken,
          expiresAt: claudeSession.expiresAt,
          userId: claudeSession.userId,
          subscriptionType: claudeSession.subscriptionType,
          account: claudeSession.account
        } : undefined,
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
    claudeSession,
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

        {/* Message History - Main Content with History Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Tab Header */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            margin: "24px 0 16px 0",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                onClick={() => setShowHistory(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: !showHistory ? "var(--claude-border)" : "transparent",
                  border: "1px solid var(--claude-border)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: !showHistory ? "var(--claude-text-primary)" : "var(--claude-text-muted)",
                  transition: "all 0.15s ease"
                }}
              >
                <MessageSquare size={14} />
                Current Chat
                {agentMessages.length > 0 && (
                  <span style={{
                    background: "var(--claude-text-accent)",
                    color: "white",
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    minWidth: "18px",
                    textAlign: "center"
                  }}>
                    {agentMessages.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => {
                  setShowHistory(true);
                  if (!hasAttemptedHistoryLoad) {
                    loadAgentHistory();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: showHistory ? "var(--claude-border)" : "transparent",
                  border: "1px solid var(--claude-border)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: showHistory ? "var(--claude-text-primary)" : "var(--claude-text-muted)",
                  transition: "all 0.15s ease"
                }}
              >
                <History size={14} />
                History
                {conversations.length > 0 && (
                  <span style={{
                    background: "var(--claude-text-accent)",
                    color: "white",
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    minWidth: "18px",
                    textAlign: "center"
                  }}>
                    {conversations.length}
                  </span>
                )}
              </button>
            </div>
            
            {!showHistory && agentMessages.length > 0 && (
              <span style={{
                fontSize: "12px",
                color: "var(--claude-text-muted)"
              }}>
                Last activity: {lastActivity}
              </span>
            )}
          </div>
          
          {/* Content Area */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {!showHistory ? (
              /* Current Conversation */
              <div className="messages-container" style={{ height: "100%" }}>
                <ChatMessages
                  messages={agentMessages}
                  isLoading={isLoading}
                  onExecuteStep={handleExecuteStep}
                  onExecutePlan={handleExecutePlan}
                  currentAgentId={agentId}
                />
              </div>
            ) : (
              /* History Panel */
              <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {historyLoading ? (
                  <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center" 
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        border: "2px solid var(--claude-border)",
                        borderTop: "2px solid var(--claude-text-accent)",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto 16px"
                      }}></div>
                      <p style={{ color: "var(--claude-text-muted)", fontSize: "14px" }}>
                        Loading conversation history...
                      </p>
                    </div>
                  </div>
                ) : historyError ? (
                  <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center" 
                  }}>
                    <div style={{ textAlign: "center", maxWidth: "400px" }}>
                      <div style={{
                        width: "48px",
                        height: "48px",
                        margin: "0 auto 16px",
                        background: "var(--claude-error-bg, #fef2f2)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <svg style={{ width: "24px", height: "24px", color: "var(--claude-error, #ef4444)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 style={{ 
                        fontSize: "16px", 
                        fontWeight: 600, 
                        margin: "0 0 8px 0",
                        color: "var(--claude-text-primary)"
                      }}>
                        Error Loading History
                      </h3>
                      <p style={{ 
                        fontSize: "14px", 
                        color: "var(--claude-text-muted)",
                        margin: 0
                      }}>
                        {historyError}
                      </p>
                    </div>
                  </div>
                ) : conversations.length === 0 ? (
                  <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center" 
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        width: "48px",
                        height: "48px",
                        margin: "0 auto 16px",
                        background: "var(--claude-border)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <History style={{ width: "24px", height: "24px", color: "var(--claude-text-muted)" }} />
                      </div>
                      <h3 style={{ 
                        fontSize: "16px", 
                        fontWeight: 600, 
                        margin: "0 0 8px 0",
                        color: "var(--claude-text-primary)"
                      }}>
                        No Conversations Yet
                      </h3>
                      <p style={{ 
                        fontSize: "14px", 
                        color: "var(--claude-text-muted)",
                        margin: 0
                      }}>
                        Start chatting with this agent to see conversation history here.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* History List */
                  <div style={{ 
                    height: "100%", 
                    overflow: "auto",
                    padding: "0 8px"
                  }}>
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.sessionId}
                        onClick={() => handleHistoryConversationSelect(conversation.sessionId)}
                        style={{
                          padding: "16px",
                          margin: "0 0 12px 0",
                          background: "var(--claude-message-bg)",
                          border: "1px solid var(--claude-border)",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--claude-text-accent)";
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--claude-border)";
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <h4 style={{
                                fontSize: "14px",
                                fontWeight: 500,
                                margin: 0,
                                color: "var(--claude-text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                              }}>
                                Session: {conversation.sessionId.substring(0, 8)}...
                              </h4>
                              <span style={{
                                fontSize: "11px",
                                background: "var(--claude-text-accent)",
                                color: "white",
                                padding: "2px 6px",
                                borderRadius: "4px"
                              }}>
                                Remote
                              </span>
                            </div>
                            <p style={{
                              fontSize: "12px",
                              color: "var(--claude-text-muted)",
                              margin: "0 0 8px 0"
                            }}>
                              {new Date(conversation.startTime).toLocaleString()} • {conversation.messageCount} messages
                            </p>
                            <p style={{
                              fontSize: "13px",
                              color: "var(--claude-text-secondary)",
                              margin: 0,
                              lineHeight: "1.4",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden"
                            }}>
                              {conversation.lastMessagePreview}
                            </p>
                          </div>
                          <div style={{ marginLeft: "12px", flexShrink: 0 }}>
                            <svg style={{ width: "16px", height: "16px", color: "var(--claude-text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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