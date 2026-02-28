import {
  Code, Terminal, Shield, Eye, Wrench, Cpu, Database, Globe,
  Zap, Brain, Search, FileCode, GitBranch, Layers, Palette,
  Rocket, Bug, Lock, Compass, BookOpen, Cog, Heart,
  Star, Lightbulb, Wand2, Telescope, Hammer, Gauge, Users,
  type LucideIcon,
} from "lucide-react";
import type { Agent } from "../../hooks/useAgentConfig";
import { getAgentColor } from "../../utils/agentColors";

/** Map of supported lucide icon names to their components */
export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Code, Terminal, Shield, Eye, Wrench, Cpu, Database, Globe,
  Zap, Brain, Search, FileCode, GitBranch, Layers, Palette,
  Rocket, Bug, Lock, Compass, BookOpen, Cog, Heart,
  Star, Lightbulb, Wand2, Telescope, Hammer, Gauge, Users,
};

const SIZE_CONFIG = {
  sm:  { px: 24, fontSize: 11, iconSize: 12 },
  md:  { px: 28, fontSize: 13, iconSize: 14 },
  lg:  { px: 48, fontSize: 20, iconSize: 22 },
} as const;

interface AgentAvatarProps {
  agent: Agent;
  size: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
}

export function AgentAvatar({ agent, size, showBadge = false, className = '' }: AgentAvatarProps) {
  const { px, fontSize, iconSize } = SIZE_CONFIG[size];
  const bgColor = getAgentColor(agent);

  const containerStyle: React.CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    borderRadius: '50%',
    backgroundColor: bgColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize,
    fontWeight: 600,
    lineHeight: 1,
    position: 'relative',
    overflow: showBadge ? 'visible' : 'hidden',
  };

  const renderContent = () => {
    const avatar = agent.avatar;

    // Emoji avatar
    if (avatar?.type === 'emoji' && avatar.value) {
      return <span style={{ fontSize: fontSize + 2, lineHeight: 1 }}>{avatar.value}</span>;
    }

    // Lucide icon avatar
    if (avatar?.type === 'lucide-icon' && avatar.value) {
      const IconComponent = LUCIDE_ICON_MAP[avatar.value];
      if (IconComponent) {
        return <IconComponent size={iconSize} />;
      }
    }

    // Letter fallback (default)
    const letter = avatar?.type === 'letter' && avatar.value
      ? avatar.value
      : agent.name.charAt(0).toUpperCase();
    return <span>{letter}</span>;
  };

  return (
    <div
      className={`agent-avatar agent-avatar-${size} ${className}`}
      style={containerStyle}
      title={agent.name}
    >
      {renderContent()}
      {showBadge && agent.role && agent.role !== 'custom' && (
        <span
          className="agent-avatar-role-dot"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: bgColor,
            border: '2px solid var(--claude-bg)',
            filter: 'brightness(1.3)',
          }}
        />
      )}
    </div>
  );
}
