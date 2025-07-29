import type {
  ChatMessage,
  SystemMessage,
  ToolMessage,
  ToolResultMessage,
  OrchestrationMessage,
  ExecutionStep,
} from "../types";
import { CollapsibleDetails } from "./messages/CollapsibleDetails";
import { MESSAGE_CONSTANTS } from "../utils/constants";
import { useAgentConfig } from "../hooks/useAgentConfig";

interface ChatMessageComponentProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const { getAgentById } = useAgentConfig();
  const isUser = message.role === "user";
  const agent = message.agentId ? getAgentById(message.agentId) : null;

  const displayName = isUser 
    ? "User" 
    : agent 
    ? agent.name 
    : "Claude";

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="message-item animate-in">
      {/* Avatar */}
      <div 
        className={`message-avatar ${isUser ? 'user' : ''}`}
        style={!isUser && agent ? { 
          backgroundColor: `var(--agent-${agent.id.replace('readymojo-', '').replace('peakmojo-', '')})`
        } : {}}
      >
        {isUser ? "U" : agent?.name.charAt(0) || "C"}
      </div>

      {/* Message Content */}
      <div className="message-content">
        {/* Header */}
        <div className="message-header">
          <span className="message-author">{displayName}</span>
          <span className="message-time">{formatTime(message.timestamp)}</span>
          {agent && (
            <span className="message-agent">@{agent.id}</span>
          )}
        </div>

        {/* Message Body */}
        <div className="message-body">
          <div className="message-text">{message.content}</div>
        </div>
      </div>
    </div>
  );
}

interface SystemMessageComponentProps {
  message: SystemMessage;
}

export function SystemMessageComponent({
  message,
}: SystemMessageComponentProps) {
  // Generate details based on message type and subtype
  const getDetails = () => {
    if (message.type === "system" && message.subtype === "init") {
      return [
        `Model: ${message.model}`,
        `Session: ${message.session_id.substring(0, MESSAGE_CONSTANTS.SESSION_ID_DISPLAY_LENGTH)}`,
        `Tools: ${message.tools.length} available`,
        `CWD: ${message.cwd}`,
        `Permission Mode: ${message.permissionMode}`,
        `API Key Source: ${message.apiKeySource}`,
      ].join("\n");
    } else if (message.type === "result") {
      const details = [
        `Duration: ${message.duration_ms}ms`,
        `Cost: $${message.total_cost_usd.toFixed(4)}`,
        `Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`,
      ];
      return details.join("\n");
    } else if (message.type === "error") {
      return message.message;
    }
    return JSON.stringify(message, null, 2);
  };

  // Get label based on message type
  const getLabel = () => {
    if (message.type === "system") return "System";
    if (message.type === "result") return "Result";
    if (message.type === "error") return "Error";
    return "Message";
  };

  const details = getDetails();
  const label = getLabel();

  return (
    <CollapsibleDetails
      label={`⚙ ${label}(${message.subtype || 'info'})`}
      details={details}
      defaultCollapsed={true}
    />
  );
}

interface ToolMessageComponentProps {
  message: ToolMessage;
}

export function ToolMessageComponent({ message }: ToolMessageComponentProps) {
  return (
    <CollapsibleDetails
      label={`🔧 Tool ${message.content}`}
      details=""
      defaultCollapsed={false}
    />
  );
}

interface ToolResultMessageComponentProps {
  message: ToolResultMessage;
}

export function ToolResultMessageComponent({
  message,
}: ToolResultMessageComponentProps) {
  const lines = message.content.split('\n').length;
  return (
    <CollapsibleDetails
      label={`✓ Tool result(${lines} lines)`}
      details={message.content}
      defaultCollapsed={true}
    />
  );
}

interface OrchestrationMessageComponentProps {
  message: OrchestrationMessage;
  onExecuteStep?: (step: ExecutionStep) => void;
  onExecutePlan?: (steps: ExecutionStep[]) => void;
}

export function OrchestrationMessageComponent({ 
  message, 
  onExecuteStep,
  onExecutePlan
}: OrchestrationMessageComponentProps) {
  const { getAgentById } = useAgentConfig();
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'pending': return 'var(--claude-text-muted)';
      case 'in_progress': return 'var(--claude-text-accent)';
      case 'completed': return 'var(--claude-success)';
      case 'failed': return 'var(--claude-error)';
      default: return 'var(--claude-text-muted)';
    }
  };

  return (
    <div className="message-item animate-in">
      {/* Avatar */}
      <div className="message-avatar" style={{ background: 'linear-gradient(135deg, var(--agent-admin), var(--agent-web))' }}>
        GC
      </div>

      {/* Message Content */}
      <div className="message-content">
        {/* Header */}
        <div className="message-header">
          <span className="message-author">Agent Room</span>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>

        {/* Orchestration Steps */}
        <div className="message-body">
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{ 
              fontSize: '13px', 
              color: 'var(--claude-text-secondary)',
              fontWeight: 500
            }}>
              📋 Execution Plan ({message.steps.length} steps)
            </div>
            
            {onExecutePlan && (
              <button
                onClick={() => onExecutePlan(message.steps)}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--claude-text-primary)',
                  background: 'var(--claude-text-accent)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Execute Plan
              </button>
            )}
          </div>
          
          {message.steps.map((step, index) => {
            const agent = getAgentById(step.agent);
            return (
              <div 
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '8px 12px',
                  marginBottom: '8px',
                  background: 'var(--claude-input-bg)',
                  border: '1px solid var(--claude-input-border)',
                  borderRadius: '6px',
                  cursor: step.status === 'pending' && onExecuteStep ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (step.status === 'pending' && onExecuteStep) {
                    onExecuteStep(step);
                  }
                }}
              >
                {/* Step number and status */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '60px'
                }}>
                  <span style={{ 
                    fontSize: '11px',
                    color: 'var(--claude-text-muted)',
                    fontWeight: 600
                  }}>
                    {index + 1}.
                  </span>
                  <span style={{ color: getStatusColor(step.status) }}>
                    {getStatusIcon(step.status)}
                  </span>
                </div>

                {/* Agent and message */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    {agent && (
                      <div 
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: `var(--agent-${agent.id.replace('readymojo-', '').replace('peakmojo-', '')})`,
                          flexShrink: 0
                        }}
                      />
                    )}
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--claude-text-primary)'
                    }}>
                      {agent?.name || step.agent}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--claude-text-secondary)',
                    lineHeight: 1.4
                  }}>
                    {step.message}
                  </div>
                  
                  {/* Show result if completed */}
                  {step.result && step.status === 'completed' && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'var(--claude-message-bg)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: 'var(--claude-text-primary)',
                      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
                      maxHeight: '100px',
                      overflow: 'auto'
                    }}>
                      {step.result.length > 200 ? step.result.substring(0, 200) + '...' : step.result}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface LoadingComponentProps {
  agentId?: string;
}

export function LoadingComponent({ agentId }: LoadingComponentProps = {}) {
  const { getAgentById } = useAgentConfig();
  const agent = agentId ? getAgentById(agentId) : null;
  const displayName = agent ? agent.name : "Claude";
  const avatarLetter = agent ? agent.name.charAt(0).toUpperCase() : "C";

  return (
    <div className="message-item animate-in">
      {/* Avatar */}
      <div className="message-avatar">
        {avatarLetter}
      </div>

      {/* Message Content */}
      <div className="message-content">
        {/* Header */}
        <div className="message-header">
          <span className="message-author">{displayName}</span>
          <span className="message-time">now</span>
        </div>

        {/* Message Body */}
        <div className="message-body">
          <div className="message-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid var(--claude-text-muted)',
              borderTop: '2px solid var(--claude-text-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span style={{ color: 'var(--claude-text-muted)' }}>Thinking...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
