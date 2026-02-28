import { useState } from "react";
import { LUCIDE_ICON_MAP } from "../shared/AgentAvatar";
import type { AgentAvatar } from "../../hooks/useAgentConfig";

const EMOJI_OPTIONS = [
  "\u{1F916}", "\u2699\uFE0F", "\u{1F6E1}\uFE0F", "\u{1F9E0}", "\u{1F680}",
  "\u{1F50D}", "\u{1F4BB}", "\u{1F528}", "\u26A1", "\u{1F3AF}",
  "\u{1F4DA}", "\u{1F512}", "\u{1F310}", "\u{1F41B}", "\u{1F4A1}",
  "\u{1F52D}", "\u2764\uFE0F", "\u2B50", "\u{1F525}", "\u{1F308}",
];

type TabId = "letter" | "emoji" | "icon";

interface AvatarPickerProps {
  value: AgentAvatar | undefined;
  onChange: (avatar: AgentAvatar) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const currentTab: TabId = value?.type === "emoji"
    ? "emoji"
    : value?.type === "lucide-icon"
    ? "icon"
    : "letter";

  const [activeTab, setActiveTab] = useState<TabId>(currentTab);

  const tabs: { id: TabId; label: string }[] = [
    { id: "letter", label: "Letter" },
    { id: "emoji", label: "Emoji" },
    { id: "icon", label: "Icon" },
  ];

  const iconNames = Object.keys(LUCIDE_ICON_MAP);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          background: "var(--claude-input-bg)",
          borderRadius: "6px",
          padding: "2px",
          border: "1px solid var(--claude-border)",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
              color:
                activeTab === tab.id
                  ? "var(--claude-text-primary)"
                  : "var(--claude-text-muted)",
              background:
                activeTab === tab.id
                  ? "var(--claude-sidebar-hover)"
                  : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "letter" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <input
            type="text"
            maxLength={2}
            value={value?.type === "letter" ? value.value : ""}
            placeholder="A"
            onChange={(e) =>
              onChange({ type: "letter", value: e.target.value.toUpperCase() })
            }
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--claude-border)",
              background: "var(--claude-input-bg)",
              color: "var(--claude-text-primary)",
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
              width: "60px",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              color: "var(--claude-text-muted)",
            }}
          >
            1-2 characters
          </span>
        </div>
      )}

      {activeTab === "emoji" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
          }}
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onChange({ type: "emoji", value: emoji })}
              style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                fontSize: "16px",
                border:
                  value?.type === "emoji" && value.value === emoji
                    ? "2px solid var(--claude-text-accent)"
                    : "1px solid var(--claude-border)",
                background:
                  value?.type === "emoji" && value.value === emoji
                    ? "var(--claude-sidebar-hover)"
                    : "var(--claude-input-bg)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {activeTab === "icon" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
          }}
        >
          {iconNames.map((name) => {
            const Icon = LUCIDE_ICON_MAP[name];
            const isSelected =
              value?.type === "lucide-icon" && value.value === name;
            return (
              <button
                key={name}
                onClick={() => onChange({ type: "lucide-icon", value: name })}
                title={name}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  border: isSelected
                    ? "2px solid var(--claude-text-accent)"
                    : "1px solid var(--claude-border)",
                  background: isSelected
                    ? "var(--claude-sidebar-hover)"
                    : "var(--claude-input-bg)",
                  color: isSelected
                    ? "var(--claude-text-accent)"
                    : "var(--claude-text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
