import { useState, useEffect } from "react";
import {
  CLAUDE_CODE_TOOLS,
  TOOL_PRESETS,
  getToolsByCategory,
  matchPreset,
} from "../../config/toolPresets";

interface ToolPermissionPickerProps {
  value: string[] | undefined; // undefined = all tools (no restriction)
  onChange: (tools: string[] | undefined) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  file: "File Operations",
  search: "Search",
  system: "System",
  web: "Web",
};

const CATEGORIES = ["file", "search", "system", "web"] as const;

export function ToolPermissionPicker({ value, onChange }: ToolPermissionPickerProps) {
  const [selectedPreset, setSelectedPreset] = useState(() => matchPreset(value));
  const [customTools, setCustomTools] = useState<Set<string>>(() =>
    new Set(value ?? CLAUDE_CODE_TOOLS.map(t => t.name))
  );

  // Sync preset selection when value prop changes externally
  useEffect(() => {
    const matched = matchPreset(value);
    setSelectedPreset(matched);
    if (matched === "custom" && value !== undefined) {
      setCustomTools(new Set(value));
    }
  }, [value]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);

    const preset = TOOL_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    if (presetId === "full") {
      onChange(undefined);
    } else if (presetId === "custom") {
      // Switch to custom — emit current custom selection
      const tools = Array.from(customTools);
      onChange(tools.length > 0 ? tools : []);
    } else if (preset.tools) {
      onChange([...preset.tools]);
    }
  };

  const handleToolToggle = (toolName: string) => {
    const next = new Set(customTools);
    if (next.has(toolName)) {
      next.delete(toolName);
    } else {
      next.add(toolName);
    }
    setCustomTools(next);
    onChange(next.size > 0 ? Array.from(next) : []);
  };

  return (
    <div>
      {/* Preset radio group */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        {TOOL_PRESETS.map(preset => (
          <label
            key={preset.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: `1px solid ${selectedPreset === preset.id ? "var(--claude-text-accent)" : "var(--claude-border)"}`,
              background: selectedPreset === preset.id ? "var(--claude-input-bg)" : "transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <input
              type="radio"
              name="tool-preset"
              value={preset.id}
              checked={selectedPreset === preset.id}
              onChange={() => handlePresetChange(preset.id)}
              style={{ accentColor: "var(--claude-text-accent)" }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--claude-text-primary)",
                }}
              >
                {preset.label}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--claude-text-muted)",
                  marginTop: "2px",
                }}
              >
                {preset.description}
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Custom tool checklist */}
      {selectedPreset === "custom" && (
        <div
          style={{
            border: "1px solid var(--claude-border)",
            borderRadius: "8px",
            padding: "12px",
            background: "var(--claude-input-bg)",
          }}
        >
          {CATEGORIES.map(category => {
            const tools = getToolsByCategory(category);
            if (tools.length === 0) return null;

            return (
              <div key={category} style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--claude-text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  {CATEGORY_LABELS[category]}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {tools.map(tool => (
                    <label
                      key={tool.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "var(--claude-sidebar-hover)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={customTools.has(tool.name)}
                        onChange={() => handleToolToggle(tool.name)}
                        style={{ accentColor: "var(--claude-text-accent)" }}
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--claude-text-primary)",
                        }}
                      >
                        {tool.name}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--claude-text-muted)",
                        }}
                      >
                        {tool.description}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
