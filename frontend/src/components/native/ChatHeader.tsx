import { Users, User, MoreHorizontal, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAgentConfig } from "../../hooks/useAgentConfig";

interface ChatHeaderProps {
  currentMode: "group" | "agent";
  activeAgentId: string | null;
  onModeToggle: () => void;
}

const getAgentColor = (agentId: string) => {
  // Map agent IDs to CSS color variables, with fallback
  const colorMap: Record<string, string> = {
    "readymojo-admin": "var(--agent-admin)",
    "readymojo-api": "var(--agent-api)", 
    "readymojo-web": "var(--agent-web)",
    "peakmojo-kit": "var(--agent-kit)",
  };
  return colorMap[agentId] || "var(--claude-text-accent)";
};

export function ChatHeader({ currentMode, activeAgentId }: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { getAgentById } = useAgentConfig();
  const currentAgent = activeAgentId ? getAgentById(activeAgentId) : null;

  return (
    <div className="chat-header app-drag-region">
      <div className="chat-header-left app-no-drag">
        {currentMode === "group" ? (
          <>
            <div 
              className="chat-header-icon"
              style={{ background: "linear-gradient(135deg, var(--agent-admin), var(--agent-web))" }}
            >
              <Users size={12} />
            </div>
            <div className="chat-header-info">
              <h2>Agent Room</h2>
              <p>@mention to call out agents</p>
            </div>
          </>
        ) : (
          <>
            <div 
              className="chat-header-icon"
              style={{ backgroundColor: currentAgent ? getAgentColor(currentAgent.id) : "var(--claude-border)" }}
            >
              <User size={12} />
            </div>
            <div className="chat-header-info">
              <h2>{currentAgent?.name || "Select Agent"}</h2>
              <p>Agent Details</p>
            </div>
          </>
        )}
      </div>

      <div className="chat-header-actions app-no-drag">
        {/* More Menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="chat-header-button"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div 
              className="chat-header-menu"
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: "8px",
                width: "200px",
                background: "var(--claude-message-bg)",
                border: "1px solid var(--claude-border)",
                borderRadius: "8px",
                padding: "4px",
                zIndex: 10,
                boxShadow: "var(--claude-shadow)"
              }}
            >
              <button 
                className="chat-header-button"
                style={{ 
                  width: "100%", 
                  justifyContent: "flex-start", 
                  gap: "8px", 
                  padding: "8px 12px",
                  fontSize: "13px"
                }}
              >
                <Download size={14} />
                Export Conversation
              </button>
              <button 
                className="chat-header-button"
                style={{ 
                  width: "100%", 
                  justifyContent: "flex-start", 
                  gap: "8px", 
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "var(--claude-error)"
                }}
              >
                <Trash2 size={14} />
                Clear History
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}