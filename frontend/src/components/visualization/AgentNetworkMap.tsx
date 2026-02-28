import { useState } from "react";
import type { Agent } from "../../hooks/useAgentConfig";
import type { AgentGraph } from "../../types/agentGraph";
import "./visualization.css";

interface AgentNetworkMapProps {
  agents: Agent[];
  graph: AgentGraph;
  onAgentClick?: (agentId: string) => void;
}

const NODE_RADIUS = 22;

const STATUS_COLORS: Record<string, string> = {
  idle: '#22c55e',
  active: '#f59e0b',
  busy: '#ef4444',
};

export function AgentNetworkMap({ agents, graph, onAgentClick }: AgentNetworkMapProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const maxWeight = Math.max(1, ...graph.edges.map(e => e.weight));

  const getStrokeWidth = (weight: number) => {
    return 1 + (weight / maxWeight) * 4; // min 1, max 5
  };

  const getOpacity = (weight: number) => {
    return 0.3 + (weight / maxWeight) * 0.7; // min 0.3, max 1.0
  };

  const getInitial = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return '?';
    if (agent.avatar?.type === 'letter' && agent.avatar.value) return agent.avatar.value;
    return agent.name.charAt(0).toUpperCase();
  };

  const getNode = (id: string) => graph.nodes.find(n => n.id === id);

  const handleMouseEnter = (nodeId: string, event: React.MouseEvent<SVGGElement>) => {
    setHoveredNode(nodeId);
    const svgRect = (event.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect();
    if (svgRect) {
      const node = getNode(nodeId);
      if (node) {
        const scaleX = svgRect.width / 500;
        const scaleY = svgRect.height / 400;
        setTooltipPos({
          x: node.position.x * scaleX,
          y: node.position.y * scaleY - NODE_RADIUS - 8,
        });
      }
    }
  };

  const hoveredNodeData = hoveredNode ? getNode(hoveredNode) : null;

  return (
    <div className="agent-network-map" style={{ position: 'relative' }}>
      <svg
        width="100%"
        height="400"
        viewBox="0 0 500 400"
        style={{ display: 'block' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 8 3, 0 6"
              fill="var(--claude-border, #333)"
            />
          </marker>
        </defs>

        {/* Edges */}
        {graph.edges.map(edge => {
          const fromNode = getNode(edge.from);
          const toNode = getNode(edge.to);
          if (!fromNode || !toNode) return null;

          // Shorten line to avoid overlapping node circles
          const dx = toNode.position.x - fromNode.position.x;
          const dy = toNode.position.y - fromNode.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return null;
          const ux = dx / dist;
          const uy = dy / dist;

          const x1 = fromNode.position.x + ux * (NODE_RADIUS + 2);
          const y1 = fromNode.position.y + uy * (NODE_RADIUS + 2);
          const x2 = toNode.position.x - ux * (NODE_RADIUS + 10);
          const y2 = toNode.position.y - uy * (NODE_RADIUS + 10);

          return (
            <line
              key={edge.id}
              className="edge"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--claude-border, #333)"
              strokeWidth={getStrokeWidth(edge.weight)}
              opacity={getOpacity(edge.weight)}
              markerEnd={edge.type === 'pipeline' ? 'url(#arrowhead)' : undefined}
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map(node => (
          <g
            key={node.id}
            className="node"
            onClick={() => onAgentClick?.(node.id)}
            onMouseEnter={(e) => handleMouseEnter(node.id, e)}
            onMouseLeave={() => setHoveredNode(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Orchestrator ring */}
            {node.isOrchestrator && (
              <circle
                cx={node.position.x}
                cy={node.position.y}
                r={NODE_RADIUS + 4}
                fill="none"
                stroke={node.color}
                strokeWidth={2}
                strokeDasharray="4 2"
                opacity={0.5}
              />
            )}

            {/* Main circle */}
            <circle
              cx={node.position.x}
              cy={node.position.y}
              r={NODE_RADIUS}
              fill={node.color}
            />

            {/* Initial letter */}
            <text
              x={node.position.x}
              y={node.position.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#fff"
              fontSize={14}
              fontWeight={600}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {getInitial(node.id)}
            </text>

            {/* Status indicator dot */}
            <circle
              cx={node.position.x + NODE_RADIUS * 0.65}
              cy={node.position.y + NODE_RADIUS * 0.65}
              r={5}
              fill={STATUS_COLORS[node.status] || STATUS_COLORS.idle}
              stroke="var(--claude-bg, #1a1a2e)"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredNodeData && (
        <div
          className="tooltip"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="tooltip-name">{hoveredNodeData.name}</div>
          {hoveredNodeData.role && (
            <div className="tooltip-detail">Role: {hoveredNodeData.role}</div>
          )}
          <div className="tooltip-detail">Status: {hoveredNodeData.status}</div>
        </div>
      )}
    </div>
  );
}
