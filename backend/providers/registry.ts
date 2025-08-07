import type { AgentProvider } from "./types.ts";
import { OpenAIProvider } from "./openai.ts";
import { ClaudeCodeProvider } from "./claude-code.ts";

export interface AgentConfiguration {
  id: string;
  name: string;
  description: string;
  provider: string; // "openai" | "claude-code"
  apiEndpoint?: string; // For remote agents
  workingDirectory?: string;
  isOrchestrator?: boolean;
  config?: {
    apiKey?: string; // For OpenAI
    claudePath?: string; // For Claude Code
    temperature?: number;
    maxTokens?: number;
  };
}

export class ProviderRegistry {
  private providers = new Map<string, AgentProvider>();
  private agentConfigs = new Map<string, AgentConfiguration>();
  
  /**
   * Register a provider instance
   */
  registerProvider(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
  }
  
  /**
   * Register an agent configuration
   */
  registerAgent(config: AgentConfiguration): void {
    this.agentConfigs.set(config.id, config);
  }
  
  /**
   * Get provider by ID
   */
  getProvider(providerId: string): AgentProvider | undefined {
    return this.providers.get(providerId);
  }
  
  /**
   * Get agent configuration by ID
   */
  getAgent(agentId: string): AgentConfiguration | undefined {
    return this.agentConfigs.get(agentId);
  }
  
  /**
   * Get all registered agents
   */
  getAllAgents(): AgentConfiguration[] {
    return Array.from(this.agentConfigs.values());
  }
  
  /**
   * Get provider for a specific agent
   */
  getProviderForAgent(agentId: string): AgentProvider | undefined {
    const config = this.getAgent(agentId);
    if (!config) return undefined;
    
    return this.getProvider(config.provider);
  }
  
  /**
   * Initialize default providers
   */
  initializeDefaultProviders(options: {
    openaiApiKey?: string;
    claudePath?: string;
  }): void {
    // Register OpenAI provider if API key is available
    if (options.openaiApiKey) {
      const openaiProvider = new OpenAIProvider(options.openaiApiKey);
      this.registerProvider(openaiProvider);
    }
    
    // Register Claude Code provider if path is available
    if (options.claudePath) {
      const claudeCodeProvider = new ClaudeCodeProvider(options.claudePath);
      this.registerProvider(claudeCodeProvider);
    }
  }
  
  /**
   * Create default agent configurations
   */
  createDefaultAgents(): void {
    // UX Designer agent (OpenAI)
    this.registerAgent({
      id: "ux-designer",
      name: "UX Designer",
      description: "OpenAI-powered UX designer for analyzing interfaces and providing design feedback",
      provider: "openai",
      config: {
        temperature: 0.7,
        maxTokens: 2000,
      },
    });
    
    // Implementation agent (Claude Code)
    this.registerAgent({
      id: "implementation",
      name: "Implementation Agent", 
      description: "Claude Code agent for implementing changes and capturing screenshots",
      provider: "claude-code",
      workingDirectory: process.cwd(),
    });
    
    // Orchestrator agent (for coordination)
    this.registerAgent({
      id: "orchestrator",
      name: "Orchestrator",
      description: "Coordinates multi-agent workflows and manages task delegation",
      provider: "claude-code",
      workingDirectory: "/tmp/orchestrator",
      isOrchestrator: true,
    });
  }
}

// Global registry instance
export const globalRegistry = new ProviderRegistry();