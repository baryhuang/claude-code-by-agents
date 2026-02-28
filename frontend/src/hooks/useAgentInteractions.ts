import { useState, useCallback } from "react";
import type { Agent } from "./useAgentConfig";
import type { AgentGraph, AgentNode, AgentEdge } from "../types/agentGraph";
import { getAgentColor } from "../utils/agentColors";

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 400;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;
const RADIUS = 150;

export function useAgentInteractions() {
  const [interactions, setInteractions] = useState<Map<string, number>>(new Map());

  const trackInteraction = useCallback((fromAgentId: string, toAgentId: string) => {
    setInteractions(prev => {
      const next = new Map(prev);
      const key = `${fromAgentId}:${toAgentId}`;
      next.set(key, (next.get(key) || 0) + 1);
      return next;
    });
  }, []);

  const getGraph = useCallback((agents: Agent[]): AgentGraph => {
    const orchestrator = agents.find(a => a.isOrchestrator);
    const others = agents.filter(a => !a.isOrchestrator);

    const nodes: AgentNode[] = agents.map((agent, _i) => {
      let position: { x: number; y: number };

      if (agent.isOrchestrator) {
        position = { x: CENTER_X, y: CENTER_Y };
      } else {
        const idx = others.indexOf(agent);
        const count = others.length;
        const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
        position = {
          x: CENTER_X + RADIUS * Math.cos(angle),
          y: CENTER_Y + RADIUS * Math.sin(angle),
        };
      }

      return {
        id: agent.id,
        name: agent.name,
        color: getAgentColor(agent),
        role: agent.role,
        position,
        status: 'idle' as const,
        isOrchestrator: agent.isOrchestrator,
      };
    });

    const edges: AgentEdge[] = [];
    interactions.forEach((weight, key) => {
      const [from, to] = key.split(':');
      const fromExists = agents.some(a => a.id === from);
      const toExists = agents.some(a => a.id === to);
      if (fromExists && toExists) {
        const isPipeline = from === orchestrator?.id || to === orchestrator?.id;
        edges.push({
          id: `edge-${from}-${to}`,
          from,
          to,
          type: isPipeline ? 'pipeline' : 'collaborative',
          weight,
        });
      }
    });

    return { nodes, edges };
  }, [interactions]);

  const resetInteractions = useCallback(() => {
    setInteractions(new Map());
  }, []);

  return { trackInteraction, getGraph, resetInteractions };
}
