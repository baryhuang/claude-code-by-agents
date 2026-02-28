import { MessageCircle, Users, Settings } from "lucide-react";
import { useState } from "react";
import { useAgentConfig } from "../../hooks/useAgentConfig";
import { AgentAvatar } from "../shared/AgentAvatar";
import { SettingsModal } from "../SettingsModal";
import { AuthButton } from "../auth/AuthButton";

interface SidebarProps {
  activeAgentId: string | null;
  agentSessions: Record<string, { sessionId: string | null; messages: any[] }>;
  onAgentSelect: (agentId: string) => void;
  onNewAgentRoom: () => void;
  currentMode: "group" | "agent";
  onModeChange: (mode: "group" | "agent") => void;
}

export function Sidebar({ 
  activeAgentId, 
  agentSessions, 
  onAgentSelect, 
  onNewAgentRoom,
  currentMode,
  onModeChange 
}: SidebarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { getWorkerAgents } = useAgentConfig();
  const agents = getWorkerAgents();

  return (
    <div className="layout-sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <MessageCircle size={14} />
          </div>
          <div className="sidebar-brand-text">
            <h1>Claude Ops-Deck</h1>
            <p>AI Agent Mission Control</p>
          </div>
        </div>

        {/* Agent Room Button */}
        <button
          onClick={() => {
            onNewAgentRoom();
            onModeChange("group");
          }}
          className={`sidebar-button ${currentMode === "group" ? "active" : ""}`}
        >
          <Users className="sidebar-button-icon" />
          Agent Room
          {currentMode === "group" && <span className="sidebar-button-badge">•</span>}
        </button>
      </div>

      {/* Agents Section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Agents</div>
      </div>
      
      <div className="sidebar-agent-list">
        {agents.map((agent) => {
          const isActive = activeAgentId === agent.id && currentMode === "agent";
          const hasMessages = agentSessions[agent.id]?.messages.length > 0;
          const messageCount = agentSessions[agent.id]?.messages.length || 0;
          
          return (
            <div
              key={agent.id}
              onClick={() => {
                onAgentSelect(agent.id);
                onModeChange("agent");
              }}
              className={`sidebar-agent-item ${isActive ? "active" : ""}`}
            >
              {/* Agent Indicator */}
              <AgentAvatar size="sm" agent={agent} />
              
              {/* Agent Info */}
              <div className="sidebar-agent-info">
                <div className="sidebar-agent-name">{agent.name}</div>
                <div className="sidebar-agent-desc">{agent.description}</div>
              </div>

              {/* Message Count */}
              {hasMessages && (
                <div className="sidebar-agent-count">{messageCount}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="sidebar-header" style={{ borderTop: "1px solid var(--claude-border)", borderBottom: "none" }}>
        {/* Authentication Section */}
        <AuthButton />
        
        {/* Settings Button */}
        <button 
          className="sidebar-button"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="sidebar-button-icon" />
          Settings
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
}