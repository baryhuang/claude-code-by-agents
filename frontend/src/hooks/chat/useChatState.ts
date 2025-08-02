import { useState, useCallback } from "react";
import type { AllMessage, ChatMessage } from "../../types";
import { generateId } from "../../utils/id";

interface AgentSession {
  sessionId: string | null;
  messages: AllMessage[];
}

export function useChatState() {

  const [agentSessions, setAgentSessions] = useState<Record<string, AgentSession>>({});
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [lastUsedAgentId, setLastUsedAgentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [hasShownInitMessage, setHasShownInitMessage] = useState(false);
  const [hasReceivedInit, setHasReceivedInit] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] =
    useState<ChatMessage | null>(null);
  
  // Orchestrator session - separate from individual agent sessions
  const [orchestratorSession, setAgentRoomSession] = useState<AgentSession>({
    sessionId: null,
    messages: []
  });

  // Get current session - use orchestrator session or agent session based on context
  const getCurrentSession = (useAgentRoom: boolean = false) => {
    if (useAgentRoom) {
      return orchestratorSession;
    }
    const currentAgentId = activeAgentId || 'default';
    return agentSessions[currentAgentId] || { sessionId: null, messages: [] };
  };

  // For backward compatibility, default to agent sessions
  const currentSession = getCurrentSession();
  const messages = currentSession.messages;
  const currentSessionId = currentSession.sessionId;

  // Initialize agent session if not exists
  const getOrCreateAgentSession = useCallback((agentId: string): AgentSession => {
    if (!agentSessions[agentId]) {
      return {
        sessionId: null,
        messages: []
      };
    }
    return agentSessions[agentId];
  }, [agentSessions]);

  // Switch to an agent
  const switchToAgent = useCallback((agentId: string) => {
    setActiveAgentId(agentId);
    setLastUsedAgentId(agentId); // Track as last used
    if (!agentSessions[agentId]) {
      setAgentSessions(prev => ({
        ...prev,
        [agentId]: {
          sessionId: null,
          messages: []
        }
      }));
    }
  }, [agentSessions]);

  // Get the best agent to use for messages (prioritizes active, then last used, then first available)
  const getTargetAgentId = useCallback(() => {
    if (activeAgentId) return activeAgentId;
    if (lastUsedAgentId) return lastUsedAgentId;
    // Fallback to first available agent
    return "readymojo-admin"; // Default to admin agent
  }, [activeAgentId, lastUsedAgentId]);

  // Add message - supports both orchestrator and individual agent modes
  const addMessage = useCallback((msg: AllMessage, useAgentRoom: boolean = false) => {
    if (useAgentRoom) {
      setAgentRoomSession(prev => ({
        ...prev,
        messages: [...prev.messages, msg]
      }));
    } else {
      const agentId = activeAgentId || 'default';
      
      setAgentSessions(prev => ({
        ...prev,
        [agentId]: {
          ...getOrCreateAgentSession(agentId),
          messages: [...(prev[agentId]?.messages || []), msg]
        }
      }));
    }
  }, [activeAgentId, getOrCreateAgentSession]);

  // Update last message - supports both orchestrator and individual agent modes
  const updateLastMessage = useCallback((content: string, useAgentRoom: boolean = false) => {
    if (useAgentRoom) {
      setAgentRoomSession(prev => {
        const updatedMessages = prev.messages.map((msg, index) =>
          index === prev.messages.length - 1 && msg.type === "chat"
            ? { ...msg, content }
            : msg,
        );
        return {
          ...prev,
          messages: updatedMessages
        };
      });
    } else {
      const agentId = activeAgentId || 'default';
      
      setAgentSessions(prev => {
        const currentMessages = prev[agentId]?.messages || [];
        const updatedMessages = currentMessages.map((msg, index) =>
          index === currentMessages.length - 1 && msg.type === "chat"
            ? { ...msg, content }
            : msg,
        );
        
        return {
          ...prev,
          [agentId]: {
            ...getOrCreateAgentSession(agentId),
            messages: updatedMessages
          }
        };
      });
    }
  }, [activeAgentId, getOrCreateAgentSession]);

  // Update session ID - supports both orchestrator and individual agent modes  
  const setCurrentSessionId = useCallback((sessionId: string | null, useAgentRoom: boolean = false) => {
    if (useAgentRoom) {
      setAgentRoomSession(prev => ({
        ...prev,
        sessionId
      }));
    } else {
      const agentId = activeAgentId || 'default';
      
      setAgentSessions(prev => ({
        ...prev,
        [agentId]: {
          ...getOrCreateAgentSession(agentId),
          sessionId
        }
      }));
    }
  }, [activeAgentId, getOrCreateAgentSession]);

  const clearInput = useCallback(() => {
    setInput("");
  }, []);

  const generateRequestId = useCallback(() => {
    const requestId = generateId();
    setCurrentRequestId(requestId);
    return requestId;
  }, []);

  const resetRequestState = useCallback(() => {
    setIsLoading(false);
    setCurrentRequestId(null);
    setCurrentAssistantMessage(null);
  }, []);

  const startRequest = useCallback(() => {
    setIsLoading(true);
    setCurrentAssistantMessage(null);
    setHasReceivedInit(false);
  }, []);

  // Get orchestrator context
  const getAgentRoomContext = useCallback(() => {
    return {
      messages: orchestratorSession.messages,
      sessionId: orchestratorSession.sessionId,
    };
  }, [orchestratorSession]);

  // Load historical messages into chat state
  const loadHistoricalMessages = useCallback((
    messages: AllMessage[], 
    sessionId: string, 
    agentId?: string, 
    useAgentRoom: boolean = false
  ) => {
    if (useAgentRoom) {
      // Load into orchestrator session
      setAgentRoomSession(prev => ({
        ...prev,
        messages: messages,
        sessionId: sessionId,
      }));
    } else {
      // Load into specific agent session or default
      const targetAgentId = agentId || activeAgentId || 'default';
      
      setAgentSessions(prev => ({
        ...prev,
        [targetAgentId]: {
          messages: messages,
          sessionId: sessionId,
        }
      }));
    }
  }, [activeAgentId]);

  return {
    // State
    messages,
    input,
    isLoading,
    currentSessionId,
    currentRequestId,
    hasShownInitMessage,
    hasReceivedInit,
    currentAssistantMessage,
    activeAgentId,
    agentSessions,
    lastUsedAgentId,
    orchestratorSession,

    // State setters
    setInput,
    setIsLoading,
    setCurrentSessionId,
    setCurrentRequestId,
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,

    // Helper functions
    addMessage,
    updateLastMessage,
    clearInput,
    generateRequestId,
    resetRequestState,
    startRequest,
    switchToAgent,
    getOrCreateAgentSession,
    getTargetAgentId,
    getCurrentSession,
    getAgentRoomContext,
    loadHistoricalMessages,
  };
}
