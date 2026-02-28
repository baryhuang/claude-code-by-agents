export interface AgentNode {
  id: string;
  name: string;
  color: string;
  role?: string;
  position: { x: number; y: number };
  status: 'idle' | 'active' | 'busy';
  isOrchestrator?: boolean;
}

export interface AgentEdge {
  id: string;
  from: string;
  to: string;
  type: 'pipeline' | 'collaborative';
  weight: number; // message count
}

export interface AgentGraph {
  nodes: AgentNode[];
  edges: AgentEdge[];
}
