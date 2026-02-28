// Re-export Agent type from the canonical source
export type { Agent, AgentAvatar, AgentAvatarType, AgentRole } from "../hooks/useAgentConfig";

import type { Agent } from "../hooks/useAgentConfig";

export const PREDEFINED_AGENTS: Agent[] = [
  {
    id: "orchestrator",
    name: "Orchestrator Agent",
    workingDirectory: "/tmp/orchestrator",
    color: "bg-gradient-to-r from-blue-500 to-purple-500",
    description: "Intelligent orchestrator that coordinates multi-agent workflows",
    apiEndpoint: "http://localhost:8080",
    isOrchestrator: true
  }
];

export const getAgentById = (id: string): Agent | undefined => {
  return PREDEFINED_AGENTS.find(agent => agent.id === id);
};

export const getAgentByName = (name: string): Agent | undefined => {
  return PREDEFINED_AGENTS.find(agent => 
    agent.name.toLowerCase() === name.toLowerCase()
  );
};

export const parseAgentMention = (message: string): { agentId: string | null; cleanMessage: string } => {
  // Check for multiple agent mentions - if found, use orchestrator
  const allMentions = message.match(/@(\w+(?:-\w+)*)/g);
  if (allMentions && allMentions.length > 1) {
    // Multiple mentions - should use orchestrator, don't clean the message
    return { agentId: "orchestrator", cleanMessage: message };
  }
  
  // Single mention at start - extract and clean
  const mentionMatch = message.match(/^@(\w+(?:-\w+)*)\s+(.*)$/);
  if (mentionMatch) {
    const [, agentId, cleanMessage] = mentionMatch;
    const agent = getAgentById(agentId);
    if (agent) {
      return { agentId: agent.id, cleanMessage };
    }
  }
  return { agentId: null, cleanMessage: message };
};

export const getOrchestratorAgent = (): Agent | undefined => {
  return PREDEFINED_AGENTS.find(agent => agent.isOrchestrator);
};

export const getWorkerAgents = (): Agent[] => {
  return PREDEFINED_AGENTS.filter(agent => !agent.isOrchestrator);
};