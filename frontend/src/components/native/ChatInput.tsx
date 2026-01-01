import { Send, StopCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAgentConfig } from "../../hooks/useAgentConfig";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  activeAgentId: string | null;
  currentMode: "group" | "agent";
  lastUsedAgentId: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
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

export function ChatInput({
  input,
  isLoading,
  currentRequestId,
  activeAgentId,
  currentMode,
  lastUsedAgentId,
  onInputChange,
  onSubmit,
  onAbort,
}: ChatInputProps) {
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const { getWorkerAgents, getAgentById } = useAgentConfig();
  const agents = getWorkerAgents();
  
  const [mentionDropdown, setMentionDropdown] = useState<{
    show: boolean;
    position: number;
    query: string;
    filteredAgents: typeof agents;
    selectedIndex: number;
  }>({
    show: false,
    position: 0,
    query: "",
    filteredAgents: [],
    selectedIndex: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine which agent will receive the message
  const getTargetAgent = () => {
    // Check for @mention in current input
    const mentionMatch = input.match(/^@(\w+(?:-\w+)*)/);
    if (mentionMatch) {
      const agentId = mentionMatch[1];
      return getAgentById(agentId);
    }
    
    // In group mode, use smart selection
    if (currentMode === "group") {
      // Priority: active agent, then last used, then default
      const targetAgentId = activeAgentId || lastUsedAgentId || agents[0]?.id;
      return getAgentById(targetAgentId || "");
    }
    
    // In agent mode, use active agent
    return activeAgentId ? getAgentById(activeAgentId) : null;
  };

  const targetAgent = getTargetAgent();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = Math.min(textarea.scrollHeight, 120); // max 6 lines
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  // Focus on textarea when not loading
  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  // Click outside handler to hide dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setMentionDropdown(prev => ({ ...prev, show: false }));
      }
    };

    if (mentionDropdown.show) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mentionDropdown.show]);

  // Handle @ mention detection
  const handleInputChange = (value: string) => {
    onInputChange(value);
    
    if (currentMode !== "group") return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    
    // Look for @ mention at cursor position
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = agents.filter(agent => 
        agent.name.toLowerCase().includes(query) || 
        agent.id.toLowerCase().includes(query)
      );
      
      setMentionDropdown({
        show: true,
        position: mentionMatch.index || 0,
        query,
        filteredAgents: filtered,
        selectedIndex: 0,
      });
    } else {
      setMentionDropdown(prev => ({ ...prev, show: false }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention dropdown navigation
    if (mentionDropdown.show) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setMentionDropdown(prev => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, prev.filteredAgents.length - 1)
          }));
          break;
        case "ArrowUp":
          e.preventDefault();
          setMentionDropdown(prev => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0)
          }));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (mentionDropdown.filteredAgents[mentionDropdown.selectedIndex]) {
            selectMention(mentionDropdown.filteredAgents[mentionDropdown.selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setMentionDropdown(prev => ({ ...prev, show: false }));
          break;
        default:
          break;
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const selectMention = (agent: ReturnType<typeof getWorkerAgents>[0]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = input.slice(0, cursorPosition);
    const textAfterCursor = input.slice(cursorPosition);
    
    // Find the @ symbol position
    const mentionMatch = textBeforeCursor.match(/@\w*$/);
    if (!mentionMatch) return;
    
    const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
    const newText = beforeMention + `@${agent.id} ` + textAfterCursor;
    
    onInputChange(newText);
    setMentionDropdown(prev => ({ ...prev, show: false }));
    
    // Set cursor after mention
    setTimeout(() => {
      const newCursorPos = beforeMention.length + agent.id.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const insertMention = (agentId: string) => {
    const mention = `@${agentId} `;
    onInputChange(mention + input);
    setShowAgentPicker(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="input-container">
      <form onSubmit={handleSubmit} className="input-wrapper">
        {/* Left Toolbar */}
        <div className="input-tools">

          {/* @ Mention Button (Group Mode Only) */}
          {currentMode === "group" && (
            <div style={{ position: "relative" }}>

              {/* Agent Picker Dropdown */}
              {showAgentPicker && (
                <div 
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    marginBottom: "8px",
                    left: 0,
                    width: "280px",
                    background: "var(--claude-message-bg)",
                    border: "1px solid var(--claude-border)",
                    borderRadius: "8px",
                    padding: "8px",
                    zIndex: 10,
                    boxShadow: "var(--claude-shadow)"
                  }}
                >
                  <div 
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--claude-text-muted)",
                      marginBottom: "8px",
                      paddingLeft: "8px"
                    }}
                  >
                    MENTION AGENT
                  </div>
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => insertMention(agent.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        fontSize: "13px",
                        background: "none",
                        border: "none",
                        borderRadius: "6px",
                        color: "var(--claude-text-primary)",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--claude-sidebar-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                      }}
                    >
                      <div 
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: getAgentColor(agent.id)
                        }}
                      />
                      <span style={{ fontWeight: 500 }}>@{agent.id}</span>
                      <span style={{ color: "var(--claude-text-muted)", fontSize: "11px" }}>
                        {agent.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Field */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            currentMode === "group" 
              ? "Message agents or @mention a specific one..."
              : activeAgentId 
                ? `Assign task to ${getAgentById(activeAgentId)?.name}...`
                : "Select an agent to start coding..."
          }
          disabled={isLoading}
          className="input-field"
          rows={1}
        />

        {/* Right Actions */}
        {isLoading && currentRequestId ? (
          <button
            type="button"
            onClick={onAbort}
            className="input-send"
            style={{ color: "var(--claude-error)" }}
          >
            <StopCircle size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || isLoading || (currentMode === "agent" && !activeAgentId) || (currentMode === "group" && !targetAgent)}
            className="input-send"
            onClick={handleSubmit}
          >
            <Send size={16} />
          </button>
        )}
      </form>

      {/* Input Helper Text */}
      <div className="input-help">
        {currentMode === "group" ? (
          "Press Enter to send • Use @agent-name to switch agents"
        ) : (
          "Press Enter to send • Shift+Enter for new line"
        )}
      </div>

      {/* @ Mention Dropdown */}
      {mentionDropdown.show && (
        <div 
          ref={dropdownRef}
          style={{
            position: "fixed",
            bottom: "100px", // Fixed position from bottom
            left: "260px", // Account for sidebar width
            width: "280px",
            background: "var(--claude-message-bg)",
            border: "1px solid var(--claude-border)",
            borderRadius: "8px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)"
          }}
        >
          <div 
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--claude-text-muted)",
              padding: "8px 12px 4px",
              borderBottom: "1px solid var(--claude-border)"
            }}
          >
            MENTION AGENT
          </div>
          {mentionDropdown.filteredAgents.length > 0 ? (
            mentionDropdown.filteredAgents.map((agent, index) => (
              <div
                key={agent.id}
                onClick={() => selectMention(agent)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: index === mentionDropdown.selectedIndex ? "var(--claude-border)" : "transparent",
                  borderBottom: index < mentionDropdown.filteredAgents.length - 1 ? "1px solid var(--claude-border)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <div 
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: getAgentColor(agent.id),
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 500, 
                    color: "var(--claude-text-primary)",
                    fontSize: "13px"
                  }}>
                    {agent.name}
                  </div>
                  <div style={{ 
                    fontSize: "11px", 
                    color: "var(--claude-text-muted)",
                    fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace"
                  }}>
                    @{agent.id}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{
              padding: "12px",
              textAlign: "center",
              color: "var(--claude-text-muted)",
              fontSize: "12px"
            }}>
              No agents found
            </div>
          )}
        </div>
      )}
    </div>
  );
}