/**
 * Unified agent color utility.
 * Single source of truth for agent color derivation, replacing
 * inconsistent methods across Sidebar, ChatHeader, MessageComponents,
 * MessageBubble, and AgentDetailView.
 */

const AGENT_PALETTE = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
  '#e11d48', // rose
] as const;

/**
 * Deterministic hash for a string → palette index.
 * Uses djb2 algorithm for good distribution.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Returns a consistent hex color for an agent.
 *
 * Priority:
 * 1. If agent.color is a hex value (#...), use it directly
 * 2. Otherwise, hash-select from the 12-color palette
 */
export function getAgentColor(agent: { id: string; color?: string }): string {
  // If the agent has an explicit hex color, use it
  if (agent.color && agent.color.startsWith('#')) {
    return agent.color;
  }
  // Hash-select from palette
  return AGENT_PALETTE[hashString(agent.id) % AGENT_PALETTE.length];
}

export { AGENT_PALETTE };
