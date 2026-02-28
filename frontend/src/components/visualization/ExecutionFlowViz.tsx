import type { Agent } from "../../hooks/useAgentConfig";
import { getAgentColor } from "../../utils/agentColors";
import "./visualization.css";

interface ExecutionStep {
  id: string;
  agent: string;
  message: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[];
  result?: string;
}

interface ExecutionFlowVizProps {
  steps: ExecutionStep[];
  agents: Agent[];
  onStepClick?: (stepId: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending:     { color: 'var(--claude-border, #666)',         label: 'Pending' },
  in_progress: { color: 'var(--claude-text-accent, #7c8aff)', label: 'In Progress' },
  completed:   { color: 'var(--claude-success, #22c55e)',      label: 'Completed' },
  failed:      { color: 'var(--claude-error, #ef4444)',        label: 'Failed' },
};

export function ExecutionFlowViz({ steps, agents, onStepClick }: ExecutionFlowVizProps) {
  const getAgent = (agentId: string) => agents.find(a => a.id === agentId);

  const getAgentInitial = (agentId: string) => {
    const agent = getAgent(agentId);
    if (!agent) return '?';
    if (agent.avatar?.type === 'letter' && agent.avatar.value) return agent.avatar.value;
    return agent.name.charAt(0).toUpperCase();
  };

  const getColor = (agentId: string) => {
    const agent = getAgent(agentId);
    if (!agent) return '#666';
    return getAgentColor(agent);
  };

  return (
    <div className="execution-flow">
      {steps.map((step, index) => {
        const statusCfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
        const isActive = step.status === 'in_progress';
        const showConnector = index < steps.length - 1;

        return (
          <div key={step.id}>
            {/* Step card */}
            <div
              className={`execution-flow-step ${isActive ? 'status-active' : ''}`}
              onClick={() => onStepClick?.(step.id)}
              style={
                step.status === 'completed'
                  ? { borderColor: 'var(--claude-success, #22c55e)', borderLeftWidth: 3 }
                  : step.status === 'failed'
                  ? { borderColor: 'var(--claude-error, #ef4444)', borderLeftWidth: 3 }
                  : undefined
              }
            >
              {/* Agent avatar */}
              <div
                className="execution-flow-step-avatar"
                style={{ backgroundColor: getColor(step.agent) }}
              >
                {getAgentInitial(step.agent)}
              </div>

              {/* Content */}
              <div className="execution-flow-step-content">
                <div className="execution-flow-step-message">{step.message}</div>
                <div
                  className="execution-flow-step-status"
                  style={{ color: statusCfg.color }}
                >
                  <span
                    className="execution-flow-step-status-dot"
                    style={{ backgroundColor: statusCfg.color }}
                  />
                  {statusCfg.label}
                </div>
                {step.result && (
                  <div className="execution-flow-step-result">{step.result}</div>
                )}
              </div>
            </div>

            {/* Connector to next step */}
            {showConnector && (
              <div className="execution-flow-connector">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path
                    d="M12 0 C12 0, 12 12, 12 24"
                    fill="none"
                    stroke="var(--claude-border, #333)"
                    strokeWidth={1.5}
                    strokeDasharray={steps[index + 1]?.dependencies?.includes(step.id) ? 'none' : '4 3'}
                  />
                  <polygon
                    points="8 20, 12 24, 16 20"
                    fill="var(--claude-border, #333)"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
