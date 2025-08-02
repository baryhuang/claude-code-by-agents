import { X, RotateCcw, Plus, Edit3, Trash2, Library } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "./chat/ThemeToggle";
import { useTheme } from "../hooks/useTheme";
import { useAgentConfig, type Agent } from "../hooks/useAgentConfig";
import { PredefinedAgentsModal } from "./PredefinedAgentsModal";
import { convertPredefinedToAgent, type PredefinedAgent } from "../config/predefinedAgents";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();
  const { config, resetConfig, addAgent, updateAgent, removeAgent, isInitialized } = useAgentConfig();
  
  // Local state for modal management
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showPredefinedAgents, setShowPredefinedAgents] = useState(false);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setEditingAgent(null);
      setShowAddAgent(false);
      setShowPredefinedAgents(false);
    }
  }, [isOpen]);

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all agents to defaults? This will remove any custom agents you have added.')) {
      resetConfig();
    }
  };

  const handleAddAgent = (agent: Omit<Agent, 'id'>) => {
    const newAgent: Agent = {
      ...agent,
      id: agent.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    };
    addAgent(newAgent);
    setShowAddAgent(false);
  };

  const handleUpdateAgent = (agentId: string, updates: Partial<Agent>) => {
    updateAgent(agentId, updates);
    setEditingAgent(null);
  };

  const handleDeleteAgent = (agentId: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      removeAgent(agentId);
    }
  };

  const handleAddPredefinedAgent = (predefinedAgent: PredefinedAgent, customEndpoint?: string) => {
    const agent = convertPredefinedToAgent(predefinedAgent, customEndpoint);
    addAgent(agent);
    setShowPredefinedAgents(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: "var(--claude-message-bg)",
          border: "1px solid var(--claude-border)",
          borderRadius: "12px",
          padding: "24px",
          width: "600px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "var(--claude-shadow)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px"
          }}
        >
          <h2 
            style={{
              fontSize: "18px",
              fontWeight: 600,
              margin: 0,
              color: "var(--claude-text-primary)"
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              borderRadius: "6px",
              background: "none",
              border: "none",
              color: "var(--claude-text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--claude-sidebar-hover)";
              e.currentTarget.style.color = "var(--claude-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "var(--claude-text-muted)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Theme Setting */}
        <div style={{ marginBottom: "24px" }}>
          <div 
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0"
            }}
          >
            <div>
              <h3 
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  margin: "0 0 4px 0",
                  color: "var(--claude-text-primary)"
                }}
              >
                Theme
              </h3>
              <p 
                style={{
                  fontSize: "12px",
                  color: "var(--claude-text-muted)",
                  margin: 0
                }}
              >
                Choose between light and dark mode
              </p>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>


        {/* Agent Management */}
        <div style={{ marginBottom: "24px" }}>
          <div 
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px"
            }}
          >
            <h3 
              style={{
                fontSize: "16px",
                fontWeight: 600,
                margin: 0,
                color: "var(--claude-text-primary)"
              }}
            >
              Agents
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowPredefinedAgents(true)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--claude-border)",
                  background: "var(--claude-message-bg)",
                  color: "var(--claude-text-accent)",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--claude-text-accent)";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--claude-message-bg)";
                  e.currentTarget.style.color = "var(--claude-text-accent)";
                }}
              >
                <Library size={14} />
                Add from Library
              </button>
              <button
                onClick={() => setShowAddAgent(true)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--claude-border)",
                  background: "var(--claude-text-accent)",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease"
                }}
              >
                <Plus size={14} />
                Add Custom
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <div style={{ marginBottom: "16px", textAlign: "right" }}>
            <button
              onClick={handleReset}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--claude-border)",
                background: "var(--claude-message-bg)",
                color: "var(--claude-text-secondary)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--claude-sidebar-hover)";
                e.currentTarget.style.color = "var(--claude-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--claude-message-bg)";
                e.currentTarget.style.color = "var(--claude-text-secondary)";
              }}
            >
              <RotateCcw size={12} />
              Reset to Defaults
            </button>
          </div>

          {/* Agent List */}
          <div style={{ marginBottom: "16px" }}>
            {!isInitialized ? (
              <div style={{ 
                padding: "16px", 
                textAlign: "center", 
                color: "var(--claude-text-secondary)",
                fontSize: "14px"
              }}>
                Loading agents...
              </div>
            ) : config.agents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--claude-border)",
                  background: "var(--claude-message-bg)",
                  marginBottom: "8px"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div 
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--claude-text-primary)",
                      marginBottom: "2px"
                    }}
                  >
                    {agent.name} {agent.isOrchestrator && !agent.name.toLowerCase().includes('orchestrator') && "(Orchestrator)"}
                  </div>
                  <div 
                    style={{
                      fontSize: "11px",
                      color: "var(--claude-text-muted)",
                      marginBottom: "2px"
                    }}
                  >
                    {agent.description}
                  </div>
                  {!agent.isOrchestrator && (
                    <div 
                      style={{
                        fontSize: "12px",
                        color: "var(--claude-text-muted)",
                        fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
                        marginBottom: "2px"
                      }}
                    >
                      {agent.workingDirectory}
                    </div>
                  )}
                  <div 
                    style={{
                      fontSize: "11px",
                      color: "var(--claude-text-accent)",
                      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace"
                    }}
                  >
                    {agent.apiEndpoint}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() => setEditingAgent(agent)}
                    style={{
                      padding: "4px",
                      borderRadius: "4px",
                      border: "none",
                      background: "var(--claude-border)",
                      color: "var(--claude-text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--claude-sidebar-hover)";
                      e.currentTarget.style.color = "var(--claude-text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--claude-border)";
                      e.currentTarget.style.color = "var(--claude-text-secondary)";
                    }}
                  >
                    <Edit3 size={12} />
                  </button>
                  {!agent.isOrchestrator && (
                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      style={{
                        padding: "4px",
                        borderRadius: "4px",
                        border: "none",
                        background: "var(--claude-error)",
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Add/Edit Modal */}
      {(showAddAgent || editingAgent) && (
        <AgentFormModal
          agent={editingAgent}
          onSave={editingAgent ? 
            (updates) => handleUpdateAgent(editingAgent.id, updates as Partial<Agent>) : 
            handleAddAgent
          }
          onCancel={() => {
            setShowAddAgent(false);
            setEditingAgent(null);
          }}
        />
      )}

      {/* Predefined Agents Modal */}
      <PredefinedAgentsModal
        isOpen={showPredefinedAgents}
        onClose={() => setShowPredefinedAgents(false)}
        onSelectAgent={handleAddPredefinedAgent}
      />
    </div>
  );
}

// Agent Form Modal Component
interface AgentFormModalProps {
  agent?: Agent | null;
  onSave: (agent: Omit<Agent, 'id'>) => void;
  onCancel: () => void;
}

function AgentFormModal({ agent, onSave, onCancel }: AgentFormModalProps) {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    workingDirectory: agent?.workingDirectory || '',
    description: agent?.description || '',
    color: agent?.color || 'bg-blue-500',
    apiEndpoint: agent?.apiEndpoint || 'https://api.claudecode.run',
  });

  const handleSave = () => {
    const isOrchestratorAgent = agent?.isOrchestrator;
    const requiredFields = [formData.name.trim(), formData.apiEndpoint.trim()];
    
    if (!isOrchestratorAgent) {
      requiredFields.push(formData.workingDirectory.trim());
    }
    
    if (requiredFields.some(field => !field)) {
      const missingFields = isOrchestratorAgent 
        ? 'Name and API endpoint are required'
        : 'Name, working directory, and API endpoint are required';
      alert(missingFields);
      return;
    }

    // Validation: Check if fields might be swapped
    if (!isOrchestratorAgent) {
      const workingDirLooksLikeUrl = formData.workingDirectory.trim().startsWith('http');
      const apiEndpointLooksLikePath = !formData.apiEndpoint.trim().startsWith('http');
      
      if (workingDirLooksLikeUrl || apiEndpointLooksLikePath) {
        alert('It looks like Working Directory and API Endpoint might be swapped. Working Directory should be a file path (e.g., /path/to/project), and API Endpoint should be a URL (e.g., https://...)');
        return;
      }
    }
    
    onSave(formData);
  };

  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          background: "var(--claude-message-bg)",
          border: "1px solid var(--claude-border)",
          borderRadius: "12px",
          padding: "24px",
          width: "500px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "var(--claude-shadow)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 
          style={{
            fontSize: "16px",
            fontWeight: 600,
            margin: "0 0 16px 0",
            color: "var(--claude-text-primary)"
          }}
        >
          {agent ? 'Edit Agent' : 'Add New Agent'}
        </h3>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--claude-text-primary)", marginBottom: "6px" }}>
            Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--claude-border)",
              background: "var(--claude-input-bg)",
              color: "var(--claude-text-primary)",
              fontSize: "13px"
            }}
          />
        </div>

        {!agent?.isOrchestrator && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--claude-text-primary)", marginBottom: "6px" }}>
              Working Directory *
            </label>
            <input
              type="text"
              value={formData.workingDirectory}
              onChange={(e) => setFormData(prev => ({ ...prev, workingDirectory: e.target.value }))}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--claude-border)",
                background: "var(--claude-input-bg)",
                color: "var(--claude-text-primary)",
                fontSize: "13px",
                fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace"
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--claude-text-primary)", marginBottom: "6px" }}>
            API Endpoint *
          </label>
          <input
            type="url"
            value={formData.apiEndpoint}
            onChange={(e) => setFormData(prev => ({ ...prev, apiEndpoint: e.target.value }))}
            placeholder="https://api.claudecode.run"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--claude-border)",
              background: "var(--claude-input-bg)",
              color: "var(--claude-text-primary)",
              fontSize: "13px",
              fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace"
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--claude-text-primary)", marginBottom: "6px" }}>
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--claude-border)",
              background: "var(--claude-input-bg)",
              color: "var(--claude-text-primary)",
              fontSize: "13px"
            }}
          />
        </div>


        <div style={{ display: "flex", gap: "8px", marginTop: "24px" }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: "var(--claude-text-accent)",
              color: "white",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            {agent ? 'Update' : 'Add'} Agent
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid var(--claude-border)",
              background: "var(--claude-message-bg)",
              color: "var(--claude-text-secondary)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}