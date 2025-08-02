import { useState, useCallback } from "react";
import type { ProjectInfo, ConversationSummary, ConversationHistory } from "../../../shared/types";
import { getAgentProjectsUrl, getAgentHistoriesUrl, getAgentConversationUrl } from "../config/api";

interface RemoteAgentHistoryCache {
  [agentEndpoint: string]: {
    projects?: ProjectInfo[];
    histories?: { [key: string]: ConversationSummary[] }; // key: `${projectId}:${agentId || 'all'}`
    conversations?: { [key: string]: ConversationHistory }; // key: `${projectId}:${sessionId}`
    lastFetch?: number;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useRemoteAgentHistory() {
  const [cache, setCache] = useState<RemoteAgentHistoryCache>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCacheValid = useCallback((agentEndpoint: string, type: 'projects' | 'histories' | 'conversations') => {
    const agentCache = cache[agentEndpoint];
    if (!agentCache?.lastFetch) return false;
    
    const isExpired = Date.now() - agentCache.lastFetch > CACHE_DURATION;
    return !isExpired && agentCache[type] !== undefined;
  }, [cache]);

  const fetchAgentProjects = useCallback(async (agentEndpoint: string): Promise<ProjectInfo[]> => {
    if (isCacheValid(agentEndpoint, 'projects')) {
      return cache[agentEndpoint].projects!;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getAgentProjectsUrl(agentEndpoint));
      if (!response.ok) {
        throw new Error(`Failed to fetch agent projects: ${response.statusText}`);
      }

      const data: { projects: ProjectInfo[] } = await response.json();
      
      setCache(prev => ({
        ...prev,
        [agentEndpoint]: {
          ...prev[agentEndpoint],
          projects: data.projects,
          lastFetch: Date.now(),
        }
      }));

      return data.projects;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cache, isCacheValid]);

  const fetchAgentHistories = useCallback(async (
    agentEndpoint: string, 
    projectId: string,
    agentId?: string
  ): Promise<ConversationSummary[]> => {
    const cacheKey = `${projectId}:${agentId || 'all'}`;
    if (isCacheValid(agentEndpoint, 'histories') && cache[agentEndpoint].histories?.[cacheKey]) {
      return cache[agentEndpoint].histories![cacheKey];
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getAgentHistoriesUrl(agentEndpoint, projectId, agentId));
      if (!response.ok) {
        throw new Error(`Failed to fetch agent histories: ${response.statusText}`);
      }

      const data: { conversations: ConversationSummary[] } = await response.json();
      
      setCache(prev => ({
        ...prev,
        [agentEndpoint]: {
          ...prev[agentEndpoint],
          histories: {
            ...prev[agentEndpoint]?.histories,
            [cacheKey]: data.conversations,
          },
          lastFetch: Date.now(),
        }
      }));

      return data.conversations;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cache, isCacheValid]);

  const fetchAgentConversation = useCallback(async (
    agentEndpoint: string,
    projectId: string,
    sessionId: string
  ): Promise<ConversationHistory> => {
    const conversationKey = `${projectId}:${sessionId}`;
    if (cache[agentEndpoint]?.conversations?.[conversationKey]) {
      return cache[agentEndpoint].conversations![conversationKey];
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getAgentConversationUrl(agentEndpoint, projectId, sessionId));
      if (!response.ok) {
        throw new Error(`Failed to fetch agent conversation: ${response.statusText}`);
      }

      const data: ConversationHistory = await response.json();
      
      setCache(prev => ({
        ...prev,
        [agentEndpoint]: {
          ...prev[agentEndpoint],
          conversations: {
            ...prev[agentEndpoint]?.conversations,
            [conversationKey]: data,
          },
          lastFetch: Date.now(),
        }
      }));

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cache]);

  const clearCache = useCallback((agentEndpoint?: string) => {
    if (agentEndpoint) {
      setCache(prev => {
        const newCache = { ...prev };
        delete newCache[agentEndpoint];
        return newCache;
      });
    } else {
      setCache({});
    }
  }, []);

  const getCachedProjects = useCallback((agentEndpoint: string): ProjectInfo[] | undefined => {
    return cache[agentEndpoint]?.projects;
  }, [cache]);

  const getCachedHistories = useCallback((agentEndpoint: string, projectId: string, agentId?: string): ConversationSummary[] | undefined => {
    const cacheKey = `${projectId}:${agentId || 'all'}`;
    return cache[agentEndpoint]?.histories?.[cacheKey];
  }, [cache]);

  const getCachedConversation = useCallback((
    agentEndpoint: string, 
    projectId: string, 
    sessionId: string
  ): ConversationHistory | undefined => {
    const conversationKey = `${projectId}:${sessionId}`;
    return cache[agentEndpoint]?.conversations?.[conversationKey];
  }, [cache]);

  return {
    // State
    loading,
    error,
    cache,

    // Actions
    fetchAgentProjects,
    fetchAgentHistories,
    fetchAgentConversation,
    clearCache,

    // Cache getters
    getCachedProjects,
    getCachedHistories,
    getCachedConversation,

    // Utils
    isCacheValid,
  };
}