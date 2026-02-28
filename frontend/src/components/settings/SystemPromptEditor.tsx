import { PERSONA_TEMPLATES, getTemplateByRole } from "../../config/personaTemplates";
import type { AgentRole } from "../../hooks/useAgentConfig";

interface SystemPromptEditorProps {
  value: string | undefined;
  onChange: (prompt: string) => void;
  role?: AgentRole;
  onRoleChange?: (role: AgentRole) => void;
}

const MAX_CHARS = 2000;

export function SystemPromptEditor({
  value,
  onChange,
  role,
  onRoleChange,
}: SystemPromptEditorProps) {
  const charCount = (value || "").length;

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRole = e.target.value as AgentRole;
    if (selectedRole === "custom") {
      onRoleChange?.("custom");
      return;
    }
    const template = getTemplateByRole(selectedRole);
    if (template) {
      onRoleChange?.(template.role);
      onChange(template.systemPrompt);
    }
  };

  const currentSelection = role || "custom";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--claude-text-primary)",
        }}
      >
        Persona Preset
      </label>
      <select
        value={currentSelection}
        onChange={handlePresetChange}
        style={{
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid var(--claude-border)",
          backgroundColor: "var(--claude-input-bg)",
          color: "var(--claude-text-primary)",
          fontSize: "13px",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {PERSONA_TEMPLATES.map((t) => (
          <option key={t.role} value={t.role}>
            {t.label} — {t.description}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>

      <label
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--claude-text-primary)",
          marginTop: "4px",
        }}
      >
        System Prompt
      </label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a system prompt to customize this agent's personality and behavior..."
        rows={8}
        style={{
          padding: "10px 12px",
          borderRadius: "6px",
          border: "1px solid var(--claude-border)",
          backgroundColor: "var(--claude-input-bg)",
          color: "var(--claude-text-primary)",
          fontSize: "13px",
          lineHeight: "1.5",
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
          minHeight: "120px",
        }}
      />
      <div
        style={{
          fontSize: "11px",
          color:
            charCount > MAX_CHARS
              ? "#ef4444"
              : "var(--claude-text-secondary, #888)",
          textAlign: "right",
        }}
      >
        {charCount} / {MAX_CHARS} characters
      </div>
    </div>
  );
}
