import { useState, useCallback, useEffect } from "react";
import type { ChatRequest, ChatMessage, ExecutionStep } from "../../types";
import { useTheme } from "../../hooks/useTheme";
import { useClaudeStreaming } from "../../hooks/useClaudeStreaming";
import { useChatState } from "../../hooks/chat/useChatState";
import { usePermissions } from "../../hooks/chat/usePermissions";
import { useAbortController } from "../../hooks/chat/useAbortController";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "../chat/ChatMessages"; 
import { ChatInput } from "./ChatInput";
import { AgentDetailView } from "./AgentDetailView";
import { PermissionDialog } from "../PermissionDialog";
import { getChatUrl } from "../../config/api";
import { KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useAgentConfig } from "../../hooks/useAgentConfig";
import { useHistoryLoader } from "../../hooks/useHistoryLoader";
import { useRemoteAgentHistory } from "../../hooks/useRemoteAgentHistory";
import { useClaudeAuth } from "../../hooks/useClaudeAuth";
import type { StreamingContext } from "../../hooks/streaming/useMessageProcessor";
import { debugStreamingConnection, debugStreamingChunk, debugStreamingPerformance, warnProxyBuffering } from "../../utils/streamingDebug";
import { useAgentInteractions } from "../../hooks/useAgentInteractions";
import { AgentNetworkMap } from "../visualization/AgentNetworkMap";
import "../../components/visualization/visualization.css";

export function AgentHubPage() {
  const [currentMode, setCurrentMode] = useState<"group" | "agent">("group");
  const [hubView, setHubView] = useState<"chat" | "map">("chat");
  const { trackInteraction, getGraph } = useAgentInteractions();
  
  useTheme(); // For theme switching support
  const { processStreamLine } = useClaudeStreaming();
  const { abortRequest, createAbortHandler } = useAbortController();
  const { getAgentById, getOrchestratorAgent, config, agents } = useAgentConfig();
  const historyLoader = useHistoryLoader();
  const remoteHistory = useRemoteAgentHistory();
  const { session: claudeSession } = useClaudeAuth();

  const {
    messages,
    input,
    isLoading,
    currentSessionId,
    currentRequestId,
    hasReceivedInit,
    hasShownInitMessage,
    currentAssistantMessage,
    activeAgentId,
    agentSessions,
    lastUsedAgentId,
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
    getTargetAgentId,
    getAgentRoomContext,
    getOrCreateAgentSession,
    loadHistoricalMessages,
  } = useChatState();

  const {
    permissionDialog,
    closePermissionDialog,
  } = usePermissions();


  // Handle keyboard shortcuts
  const handleAbort = useCallback(() => {
    if (currentRequestId) {
      abortRequest(currentRequestId, isLoading, resetRequestState);
    }
  }, [currentRequestId, isLoading, abortRequest, resetRequestState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_SHORTCUTS.ABORT) {
        e.preventDefault();
        if (currentRequestId) {
          handleAbort();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentRequestId, handleAbort]);

  const handleAgentSwitch = useCallback((agentId: string) => {
    switchToAgent(agentId);
  }, [switchToAgent]);

  const handleModeToggle = useCallback(() => {
    setCurrentMode(prev => prev === "group" ? "agent" : "group");
  }, []);

  const handleNewAgentRoom = useCallback(() => {
    setCurrentMode("group");
  }, []);


  const handleHistoryConversationSelect = useCallback(async (sessionId: string, agentId?: string) => {
    try {
      // Try to find the conversation in available projects
      let foundProject = null;
      
      if (agentId && agentId !== "local") {
        // For remote agents, get their projects and try to find the session
        const agent = agents.find(a => a.id === agentId);
        if (agent) {
          try {
            const agentProjects = await remoteHistory.fetchAgentProjects(agent.apiEndpoint);
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
                  break;
                }
              } catch {
                // Continue searching in other projects
              }
            }
          } catch (error) {
            console.warn("Could not search agent projects for session:", error);
          }
        }
      } else {
        // For local conversations, try current working directory projects
        // This is a simplified approach - in a full implementation we'd track
        // project context with each conversation
        foundProject = "-Users-buryhuang-git-claude-code-web-agent"; // Based on your local projects
      }
      
      // Fallback to a default if we couldn't find the project
      const projectToUse = foundProject || "default";
      
      // Load the historical conversation
      await historyLoader.loadHistory(projectToUse, sessionId, agentId);
      
      // If we have historical messages, populate the current chat
      if (historyLoader.messages.length > 0) {
        console.log("📚 Loading historical conversation:", {
          sessionId,
          agentId,
          messageCount: historyLoader.messages.length,
        });

        // Determine if this is a group/orchestrator conversation
        const isGroupConversation = !agentId || agentId === "local";
        
        // Switch to the appropriate mode and agent
        if (agentId && agentId !== "local") {
          // Switch to specific agent
          switchToAgent(agentId);
          setCurrentMode("agent");
          
          // Load messages into the agent's session
          loadHistoricalMessages(historyLoader.messages, sessionId, agentId, false);
        } else {
          // Load into orchestrator/group session
          setCurrentMode("group");
          
          // Load messages into the orchestrator session
          loadHistoricalMessages(historyLoader.messages, sessionId, undefined, true);
        }
        
        console.log("✅ Historical conversation loaded successfully");
      } else {
        console.warn("⚠️ No messages found in historical conversation");
      }
    } catch (error) {
      console.error("❌ Failed to load conversation:", error);
    }
  }, [historyLoader, switchToAgent, setCurrentMode, loadHistoricalMessages, agents, remoteHistory]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    const isGroupMode = currentMode === "group";
    let targetAgentId = activeAgentId;
    let messageContent = input.trim();
    let sessionToUse = currentSessionId;

    console.log("🚦 ROUTING DECISION START");
    console.log("📝 Input message:", input.trim());
    console.log("🎯 Current mode:", currentMode);
    console.log("👤 Active agent ID:", activeAgentId);

    // In group mode, check for mentions and route appropriately
    if (isGroupMode) {
      console.log("🏢 Group mode detected - checking for mentions");
      
      // Check for multiple mentions first - if multiple, use orchestrator
      const allMentions = input.match(/@(\w+(?:-\w+)*)/g);
      if (allMentions && allMentions.length > 1) {
        console.log("🎯 Multiple mentions detected - routing to orchestrator:", allMentions);
        targetAgentId = "orchestrator";
        messageContent = input.trim(); // Preserve all mentions
        // Use orchestrator session
        const orchestratorSession = agentSessions["orchestrator"];
        sessionToUse = orchestratorSession?.sessionId || null;
        console.log("🔄 Using orchestrator session:", sessionToUse);
        switchToAgent("orchestrator");
      } else {
        // Single mention - route directly to that agent
        const mentionMatch = input.match(/^@(\w+(?:-\w+)*)\s+(.*)$/);
        if (mentionMatch) {
          const [, agentId, cleanMessage] = mentionMatch;
          console.log("🎯 Single mention detected:", { agentId, cleanMessage });
          const agent = getAgentById(agentId);
          if (agent) {
            console.log("✅ Mentioned agent found - routing directly:", {
              id: agent.id,
              name: agent.name,
              endpoint: agent.apiEndpoint
            });
            targetAgentId = agent.id;
            // Keep the full message with @mention for history, but send clean message to agent
            messageContent = input.trim(); // Preserve @mention in display
            // Use the specific agent's session, not the group session
            const agentSession = agentSessions[agent.id];
            sessionToUse = agentSession?.sessionId || null;
            console.log("🔄 Using agent-specific session:", sessionToUse);
            switchToAgent(agent.id);
          } else {
            console.log("❌ Mentioned agent not found:", agentId);
            return; // Exit early if mentioned agent doesn't exist
          }
        } else {
          // No direct mention - route to orchestrator for general orchestration
          console.log("🏢 No direct mention - looking for orchestrator");
          const orchestratorAgent = getOrchestratorAgent();
          if (orchestratorAgent) {
            console.log("✅ Orchestrator found:", {
              id: orchestratorAgent.id,
              name: orchestratorAgent.name,
              endpoint: orchestratorAgent.apiEndpoint
            });
            targetAgentId = orchestratorAgent.id;
            // Keep the full message for the orchestrator to analyze
            messageContent = input.trim();
            // Use orchestrator session for group coordination
            const groupContext = getAgentRoomContext();
            sessionToUse = groupContext.sessionId;
            console.log("🔄 Using orchestrator session:", sessionToUse);
          } else {
            console.log("❌ No orchestrator found and no direct mention");
            targetAgentId = getTargetAgentId();
            if (targetAgentId) {
              console.log("✅ Fallback to target agent ID:", targetAgentId);
              switchToAgent(targetAgentId);
            } else {
              console.log("❌ No target agent ID found");
            }
          }
        }
      }
    } else {
      console.log("👤 Agent mode - using active agent");
    }

    if (!targetAgentId) {
      console.log("❌ ROUTING FAILED - No target agent ID");
      return;
    }

    console.log("🎯 FINAL ROUTING DECISION:");
    console.log("  Target Agent ID:", targetAgentId);
    console.log("  Message Content:", messageContent);
    console.log("  Session ID:", sessionToUse);

    const requestId = generateRequestId();
    
    // Add user message
    const userMessage: ChatMessage = {
      type: "chat",
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
      agentId: targetAgentId,
    };
    addMessage(userMessage, isGroupMode);

    clearInput();
    startRequest();

    // Set up streaming context
    const streamingContext: StreamingContext = {
      hasReceivedInit,
      currentAssistantMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      onSessionId: (sessionId) => setCurrentSessionId(sessionId, isGroupMode),
      addMessage: (msg) => addMessage(msg, isGroupMode),
      updateLastMessage: (content) => updateLastMessage(content, isGroupMode),
      onRequestComplete: () => resetRequestState(),
      shouldShowInitMessage: () => !hasShownInitMessage,
      onInitMessageShown: () => setHasShownInitMessage(true),
      agentId: targetAgentId, // Pass agent ID for response attribution
    };

    try {
      const currentAgent = getAgentById(targetAgentId);
      if (!currentAgent) {
        console.log("❌ CRITICAL ERROR - Agent not found for ID:", targetAgentId);
        return;
      }

      console.log("✅ Final agent selected:", {
        id: currentAgent.id,
        name: currentAgent.name,
        workingDirectory: currentAgent.workingDirectory,
        apiEndpoint: currentAgent.apiEndpoint,
        isOrchestrator: currentAgent.isOrchestrator
      });

      // For direct mentions to individual agents, send clean message
      // For orchestrator, preserve all mentions
      const messageToAgent = (targetAgentId !== "orchestrator" && messageContent.startsWith('@')) ? 
        messageContent.replace(/^@(\w+(?:-\w+)*)\s+/, '') : 
        messageContent;

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
        message: messageToAgent,
        sessionId: sessionToUse || undefined,
        requestId,
        workingDirectory: currentAgent.workingDirectory,
        systemPrompt: currentAgent.systemPrompt,
        allowedTools: currentAgent.allowedTools?.length ? currentAgent.allowedTools : undefined,
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
          isOrchestrator: agent.isOrchestrator,
          systemPrompt: agent.systemPrompt,
          role: agent.role,
        })),
      };

      const requestStartTime = Date.now();
      const targetApiEndpoint = currentAgent.apiEndpoint;
      const finalUrl = getChatUrl(targetApiEndpoint);
      
      console.log("🌐 FINAL API CALL:");
      console.log("  API Endpoint:", targetApiEndpoint);
      console.log("  Final URL:", finalUrl);
      console.log("  Request ID:", requestId);
      console.log("  Working Directory:", currentAgent.workingDirectory);
      
      debugStreamingConnection(finalUrl, { "Content-Type": "application/json" });

      const response = await fetch(finalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatRequest),
      });

      if (!response.ok) {
        console.log("❌ HTTP ERROR:");
        console.log("  Status:", response.status);
        console.log("  Status Text:", response.statusText);
        console.log("  URL:", finalUrl);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("✅ HTTP Response OK:", response.status);

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
          }, isGroupMode);
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
        }, isGroupMode);
      }
      resetRequestState();
    }
  }, [
    input,
    isLoading,
    activeAgentId,
    currentMode,
    currentSessionId,
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
    switchToAgent,
    getTargetAgentId,
    getAgentById,
    getOrchestratorAgent,
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

    const isGroupMode = currentMode === "group";
    const requestId = generateRequestId();
    
    const userMessage: ChatMessage = {
      type: "chat",
      role: "user", 
      content: step.message,
      timestamp: Date.now(),
      agentId: step.agent,
    };

    // Use orchestrator context when in group mode
    addMessage(userMessage, isGroupMode);
    startRequest();

    const streamingContext: StreamingContext = {
      hasReceivedInit,
      currentAssistantMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      onSessionId: (sessionId) => setCurrentSessionId(sessionId, isGroupMode),
      addMessage: (msg) => addMessage(msg, isGroupMode),
      updateLastMessage: (content) => updateLastMessage(content, isGroupMode),
      onRequestComplete: () => resetRequestState(),
      shouldShowInitMessage: () => !hasShownInitMessage,
      onInitMessageShown: () => setHasShownInitMessage(true),
      agentId: step.agent, // Pass agent ID for step execution
    };

    try {
      // For step execution, use the individual agent's session, not orchestrator session
      const agentSession = agentSessions[step.agent];
      const stepSessionId = agentSession?.sessionId || undefined;
      
      const chatRequest: ChatRequest = {
        message: step.message,
        sessionId: stepSessionId,
        requestId,
        workingDirectory: targetAgent.workingDirectory,
        systemPrompt: targetAgent.systemPrompt,
        allowedTools: targetAgent.allowedTools?.length ? targetAgent.allowedTools : undefined,
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
          isOrchestrator: agent.isOrchestrator,
          systemPrompt: agent.systemPrompt,
          role: agent.role,
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
          }, isGroupMode);
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
        });
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
    currentSessionId,
    processStreamLine,
    createAbortHandler,
    resetRequestState,
    getAgentById,
    currentMode,
    agentSessions,
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

  return (
    <div className="layout-main">
      {/* Top Drag Bar for macOS */}
      <div 
        className="app-drag-region"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "28px",
          zIndex: 1000,
          backgroundColor: "transparent"
        }}
      />
      
      {/* Sidebar */}
      <Sidebar
        activeAgentId={activeAgentId}
        agentSessions={agentSessions}
        onAgentSelect={handleAgentSwitch}
        onNewAgentRoom={handleNewAgentRoom}
        currentMode={currentMode}
        onModeChange={setCurrentMode}
      />

      {/* Main Content */}
      <div className="layout-content">
        {/* Chat Header */}
        <ChatHeader
          currentMode={currentMode}
          activeAgentId={currentMode === "agent" ? activeAgentId : null}
          onModeToggle={handleModeToggle}
        />

        {/* Main Content Area */}
        {currentMode === "agent" && activeAgentId ? (
          /* Agent Detail View */
          <AgentDetailView
            agentId={activeAgentId}
            agentSessions={agentSessions}
            input={input}
            isLoading={isLoading}
            currentRequestId={currentRequestId}
            hasReceivedInit={hasReceivedInit}
            hasShownInitMessage={hasShownInitMessage}
            currentAssistantMessage={currentAssistantMessage}
            setInput={setInput}
            setCurrentSessionId={setCurrentSessionId}
            setHasReceivedInit={setHasReceivedInit}
            setHasShownInitMessage={setHasShownInitMessage}
            setCurrentAssistantMessage={setCurrentAssistantMessage}
            addMessage={addMessage}
            updateLastMessage={updateLastMessage}
            clearInput={clearInput}
            generateRequestId={generateRequestId}
            resetRequestState={resetRequestState}
            startRequest={startRequest}
            switchToAgent={switchToAgent}
            getOrCreateAgentSession={getOrCreateAgentSession}
            loadHistoricalMessages={loadHistoricalMessages}
          />
        ) : (
          /* Chat Interface */
          <>
            {/* View Toggle */}
            <div style={{
              display: "flex",
              gap: "2px",
              padding: "4px",
              margin: "0 12px",
              background: "var(--claude-input-bg)",
              borderRadius: "6px",
              border: "1px solid var(--claude-border)",
              width: "fit-content",
            }}>
              {(["chat", "map"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setHubView(view)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    color: hubView === view ? "var(--claude-text-primary)" : "var(--claude-text-muted)",
                    background: hubView === view ? "var(--claude-sidebar-hover)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {view}
                </button>
              ))}
            </div>

            {hubView === "map" ? (
              /* Agent Network Map */
              <div className="messages-container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AgentNetworkMap
                  agents={agents}
                  graph={getGraph(agents)}
                  onAgentClick={(agentId) => {
                    switchToAgent(agentId);
                    setCurrentMode("agent");
                  }}
                />
              </div>
            ) : (
              <>
                {/* Messages Area */}
                <div className="messages-container">
                  <ChatMessages
                    messages={currentMode === "group" ? getAgentRoomContext().messages : messages}
                    isLoading={isLoading}
                    onExecuteStep={handleExecuteStep}
                    onExecutePlan={handleExecutePlan}
                    currentAgentId={activeAgentId || undefined}
                  />
                </div>

                {/* Chat Input */}
                <ChatInput
                  input={input}
                  isLoading={isLoading}
                  currentRequestId={currentRequestId}
                  activeAgentId={activeAgentId}
                  currentMode={currentMode}
                  lastUsedAgentId={lastUsedAgentId}
                  onInputChange={setInput}
                  onSubmit={handleSendMessage}
                  onAbort={handleAbort}
                />
              </>
            )}
          </>
        )}
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