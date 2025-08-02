import { useState, useEffect } from "react";

export interface Agent {
  id: string;
  name: string;
  workingDirectory: string;
  color: string;
  description: string;
  apiEndpoint: string;
  isOrchestrator?: boolean;
}

export interface AgentSystemConfig {
  agents: Agent[];
}

const DEFAULT_AGENTS: Agent[] = [
  {
    id: "orchestrator",
    name: "Orchestrator Agent",
    workingDirectory: "/tmp/orchestrator",
    color: "bg-gradient-to-r from-blue-500 to-purple-500",
    description: "Intelligent orchestrator that coordinates multi-agent workflows",
    apiEndpoint: "https://api.claudecode.run",
    isOrchestrator: true
  }
];

const DEFAULT_CONFIG: AgentSystemConfig = {
  agents: DEFAULT_AGENTS,
};

const STORAGE_KEY = "agent-system-config";

export function useAgentConfig() {
  const [config, setConfig] = useState<AgentSystemConfig>(DEFAULT_CONFIG);
  const [isInitialized, setIsInitialized] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    // Initialize config on client side
    console.log("🚀 useAgentConfig initializing...", { storageKey: STORAGE_KEY });
    
    // Check if running in Electron
    const isElectron = window.electronAPI?.storage;
    
    if (isElectron) {
      // Use Electron's persistent storage
      window.electronAPI!.storage.loadAgentConfig().then((result) => {
        if (result.success && result.data) {
          console.log("📖 Loading from Electron storage:", result.data);
          setConfig(result.data);
        } else {
          console.log("🆕 No saved Electron config, using defaults");
          setConfig(DEFAULT_CONFIG);
          window.electronAPI!.storage.saveAgentConfig(DEFAULT_CONFIG);
        }
        setIsInitialized(true);
      }).catch((error) => {
        console.warn("❌ Failed to load from Electron storage:", error);
        setConfig(DEFAULT_CONFIG);
        setIsInitialized(true);
      });
    } else {
      // Fallback to localStorage for web
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        console.log("📖 Loading from localStorage:", saved);
      
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        console.log("📝 Parsed config:", parsedConfig);
        
        // Simply use the saved config, merging with any new default agents
        const existingAgentIds = new Set(parsedConfig.agents?.map((a: Agent) => a.id) || []);
        const newDefaultAgents = DEFAULT_CONFIG.agents.filter(agent => !existingAgentIds.has(agent.id));
        
        const mergedConfig = {
          agents: [...(parsedConfig.agents || []), ...newDefaultAgents]
        };
        console.log("🔀 Merged config:", mergedConfig);
        setConfig(mergedConfig);
        
        // Save the merged config if new agents were added
        if (newDefaultAgents.length > 0) {
          console.log("💾 Saving merged config with new agents:", newDefaultAgents);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedConfig));
        }
      } else {
        // No saved config, use defaults
        console.log("🆕 No saved config, using defaults");
        setConfig(DEFAULT_CONFIG);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      }
      } catch (error) {
        console.warn("❌ Failed to load agent configuration:", error);
        setConfig(DEFAULT_CONFIG);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      }
      setIsInitialized(true);
    }
  }, [updateTrigger]);

  // Listen for storage events and force refresh (important for Electron)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      console.log("📡 Storage event detected:", e);
      if (e.key === STORAGE_KEY) {
        console.log("🔄 Triggering config refresh due to storage change");
        setUpdateTrigger(prev => prev + 1);
      }
    };

    // Listen to custom config update events
    const handleCustomConfigUpdate = (e: CustomEvent) => {
      console.log("🎯 Custom agentConfigUpdated event received:", e.detail);
      setUpdateTrigger(prev => prev + 1);
    };

    // Listen to storage events
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('agentConfigUpdated', handleCustomConfigUpdate as EventListener);
    
    // For Electron, also listen to focus events to refresh config
    const handleFocus = () => {
      console.log("👁️ Window focus - checking for config changes");
      const current = localStorage.getItem(STORAGE_KEY);
      const currentStringified = JSON.stringify(config);
      if (current && current !== currentStringified) {
        console.log("🔄 Config changed while window was unfocused, refreshing");
        setUpdateTrigger(prev => prev + 1);
      }
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('agentConfigUpdated', handleCustomConfigUpdate as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, [config]);

  const updateConfig = (newConfig: Partial<AgentSystemConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    console.log("🔧 updateConfig called:", {
      currentConfig: config,
      newConfig,
      updatedConfig,
      storageKey: STORAGE_KEY
    });
    setConfig(updatedConfig);
    
    const isElectron = window.electronAPI?.storage;
    
    if (isElectron) {
      // Use Electron's persistent storage
      window.electronAPI!.storage.saveAgentConfig(updatedConfig).then((result) => {
        if (result.success) {
          console.log("💾 Saved to Electron storage");
          
          // Force refresh of other hook instances
          console.log("🔄 Triggering refresh for all hook instances");
          setUpdateTrigger(prev => prev + 1);
          
          // Dispatch a custom event to notify other components
          window.dispatchEvent(new CustomEvent('agentConfigUpdated', { 
            detail: updatedConfig 
          }));
        } else {
          console.error("❌ Failed to save to Electron storage:", result.error);
        }
      });
    } else {
      // Fallback to localStorage for web
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig));
        console.log("💾 Saved to localStorage:", JSON.stringify(updatedConfig, null, 2));
        
        // Verify it was saved
        const verification = localStorage.getItem(STORAGE_KEY);
        console.log("✅ Verification read:", verification);
        
        // Force refresh of other hook instances (important for Electron)
        console.log("🔄 Triggering refresh for all hook instances");
        setUpdateTrigger(prev => prev + 1);
        
        // Dispatch a custom event to notify other components
        window.dispatchEvent(new CustomEvent('agentConfigUpdated', { 
          detail: updatedConfig 
        }));
        
      } catch (error) {
        console.error("❌ Failed to save agent configuration:", error);
      }
    }
  };

  const addAgent = (agent: Agent) => {
    // Auto-assign orchestrator status if this is the first agent
    const isFirstAgent = config.agents.length === 0;
    const agentWithOrchestratorStatus = {
      ...agent,
      isOrchestrator: isFirstAgent
    };
    
    const updatedAgents = [...config.agents, agentWithOrchestratorStatus];
    updateConfig({ agents: updatedAgents });
  };

  const updateAgent = (agentId: string, updates: Partial<Agent>) => {
    const updatedAgents = config.agents.map(agent =>
      agent.id === agentId ? { ...agent, ...updates } : agent
    );
    updateConfig({ agents: updatedAgents });
  };

  const removeAgent = (agentId: string) => {
    const updatedAgents = config.agents.filter(agent => agent.id !== agentId);
    updateConfig({ agents: updatedAgents });
  };

  const resetConfig = () => {
    console.log("🔄 resetConfig called - resetting to defaults");
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("🗑️ Removed config from localStorage");
      
      // Force refresh of other hook instances (important for Electron)
      setUpdateTrigger(prev => prev + 1);
      
      // Dispatch a custom event to notify other components
      window.dispatchEvent(new CustomEvent('agentConfigUpdated', { 
        detail: DEFAULT_CONFIG 
      }));
      
    } catch (error) {
      console.error("❌ Failed to reset agent configuration:", error);
    }
  };

  const getAgentById = (id: string): Agent | undefined => {
    return config.agents.find(agent => agent.id === id);
  };

  const getWorkerAgents = (): Agent[] => {
    return config.agents.filter(agent => !agent.isOrchestrator);
  };

  const getOrchestratorAgent = (): Agent | undefined => {
    return config.agents.find(agent => agent.isOrchestrator);
  };

  return {
    config,
    agents: config.agents, // Add this for compatibility
    updateConfig,
    addAgent,
    updateAgent,
    removeAgent,
    resetConfig,
    getAgentById,
    getWorkerAgents,
    getOrchestratorAgent,
    isInitialized,
  };
}