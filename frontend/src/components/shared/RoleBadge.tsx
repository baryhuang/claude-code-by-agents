import type { AgentRole } from "../../hooks/useAgentConfig";

const ROLE_COLORS: Record<AgentRole, { bg: string; text: string }> = {
  architect: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  sprinter:  { bg: "rgba(16,185,129,0.15)", text: "#10b981" },
  reviewer:  { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  mentor:    { bg: "rgba(139,92,246,0.15)",  text: "#8b5cf6" },
  guardian:  { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  custom:    { bg: "rgba(107,114,128,0.15)", text: "#6b7280" },
};

interface RoleBadgeProps {
  role: AgentRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const colors = ROLE_COLORS[role] ?? ROLE_COLORS.custom;

  return (
    <span
      className="role-badge"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {role}
    </span>
  );
}
