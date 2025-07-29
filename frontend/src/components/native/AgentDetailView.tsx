import { Copy, Clock, FileText, GitBranch, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { AllMessage } from "../../types";
import { useAgentConfig } from "../../hooks/useAgentConfig";
import { ChatInput } from "./ChatInput";

interface AgentDetailViewProps {
  agentId: string;
  messages: AllMessage[];
  sessionId: string | null;
  // Chat functionality props
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  lastUsedAgentId: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
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
  messages, 
  sessionId, 
  input, 
  isLoading, 
  currentRequestId, 
  lastUsedAgentId, 
  onInputChange, 
  onSubmit, 
  onAbort 
}: AgentDetailViewProps) {
  const { getAgentById } = useAgentConfig();
  const agent = getAgentById(agentId);
  const [showConfig, setShowConfig] = useState(false);
  
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

  // Filter messages for this specific agent
  const agentMessages = messages.filter(msg => {
    if (msg.type !== "chat") return false;
    
    // Enhanced matching: handle both exact match and fallback cases
    const messageAgentId = ('agentId' in msg) ? msg.agentId : undefined;
    const isExactMatch = messageAgentId === agentId;
    
    // If no exact match, check if this message should belong to this agent
    // (e.g., if message has no agentId but this is the only/active agent)
    const isImplicitMatch = !messageAgentId && messages.filter(m => 
      m.type === "chat" && 'agentId' in m && m.agentId
    ).length === 0;
    
    return isExactMatch || isImplicitMatch;
  });

  // Enhanced debug logging
  console.log("🔍 AgentDetailView Debug:", {
    targetAgentId: agentId,
    totalMessages: messages.length,
    chatMessages: messages.filter(msg => msg.type === "chat").length,
    agentMessages: agentMessages.length,
    allChatMessages: messages.filter(msg => msg.type === "chat").map(msg => ({
      type: msg.type,
      role: ('role' in msg) ? msg.role : 'unknown',
      agentId: ('agentId' in msg) ? msg.agentId : 'undefined',
      content: ('content' in msg) ? msg.content.substring(0, 50) + "..." : 'no content',
      hasAgentId: ('agentId' in msg),
      agentIdValue: ('agentId' in msg) ? msg.agentId : null
    })),
    messagesWithoutAgentId: messages.filter(msg => 
      msg.type === "chat" && (!('agentId' in msg) || !msg.agentId)
    ).length,
    messagesWithAgentId: messages.filter(msg => 
      msg.type === "chat" && ('agentId' in msg) && msg.agentId
    ).length
  });
  
  const lastActivity = agentMessages.length > 0 
    ? new Date(agentMessages[agentMessages.length - 1].timestamp).toLocaleString()
    : "No activity yet";

  // Extract project name from working directory
  const projectName = agent.workingDirectory.split('/').pop() || 
                     agent.workingDirectory.split('\\').pop() || 
                     "Unknown";

  // Determine agent status
  const isActive = sessionId !== null;
  const status = isActive ? "Active" : "Idle";

  const agentColor = getAgentColor(agent.id);

  const copyPath = () => {
    navigator.clipboard.writeText(agent.workingDirectory);
  };

  return (
    <div className="agent-detail" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="agent-detail-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Agent Header with Configuration */}
        <div className="agent-detail-header">
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

        {/* Message History - Main Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 style={{ 
            fontSize: "16px", 
            fontWeight: 600, 
            margin: "24px 0 16px 0",
            color: "var(--claude-text-primary)" 
          }}>
            Recent Activity
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
          
          {agentMessages.length === 0 ? (
            <div className="empty-state">
              <div 
                className="empty-state-icon"
                style={{
                  width: "48px",
                  height: "48px",
                  fontSize: "20px",
                  background: "var(--claude-border)"
                }}
              >
                <FileText size={20} />
              </div>
              <h3>No conversation history yet</h3>
              <p>Switch to Agent Room to start talking with this agent</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div 
                style={{
                  maxHeight: "calc(100vh - 300px)",
                  overflowY: "auto",
                  borderTop: "1px solid var(--claude-border)",
                  paddingTop: "16px"
                }}
              >
                {agentMessages.slice(-10).map((message, index) => (
                  <div 
                    key={index} 
                    style={{
                      display: "flex",
                      gap: "12px",
                      fontSize: "13px",
                      marginBottom: "16px"
                    }}
                  >
                    <div 
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: ('role' in message && message.role === "user") ? "#6b7280" : agentColor,
                        marginTop: "8px",
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px"
                        }}
                      >
                        <span 
                          style={{
                            fontWeight: 500,
                            color: "var(--claude-text-primary)"
                          }}
                        >
                          {('role' in message && message.role === "user") ? "You" : agent.name}
                        </span>
                        <span 
                          style={{
                            fontSize: "11px",
                            color: "var(--claude-text-muted)"
                          }}
                        >
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p 
                        style={{
                          color: "var(--claude-text-secondary)",
                          margin: 0,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap"
                        }}
                      >
                        {'content' in message ? message.content : 'message' in message ? message.message : ''}
                      </p>
                    </div>
                  </div>
                ))}
                
                {agentMessages.length > 10 && (
                  <div 
                    style={{
                      textAlign: "center",
                      marginTop: "16px",
                      fontSize: "12px",
                      color: "var(--claude-text-muted)"
                    }}
                  >
                    Showing last 10 messages of {agentMessages.length} total
                  </div>
                )}
              </div>
            </div>
          )}
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
          lastUsedAgentId={lastUsedAgentId}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onAbort={onAbort}
        />
      </div>
    </div>
  );
}