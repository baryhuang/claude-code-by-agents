import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { ConversationSummary } from "../../../shared/types";
import { useAgentConfig } from "../hooks/useAgentConfig";
import { useRemoteAgentHistory } from "../hooks/useRemoteAgentHistory";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationSelect: (sessionId: string, agentId?: string) => void;
  activeAgentId?: string; // The specific agent whose history we're viewing
}

interface AgentConversations {
  agentId: string;
  agentName: string;
  conversations: ConversationSummary[];
  isLocal: boolean;
}

export function HistoryModal({ isOpen, onClose, onConversationSelect, activeAgentId }: HistoryModalProps) {
  const [allAgentConversations, setAllAgentConversations] = useState<AgentConversations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  // No need for tabs anymore since we're showing only one agent's history
  
  const { config } = useAgentConfig();
  const agents = config.agents;
  const remoteHistory = useRemoteAgentHistory();

  useEffect(() => {
    if (!isOpen) {
      // Reset load attempt flag when modal closes
      setHasAttemptedLoad(false);
      return;
    }

    // Prevent infinite loop - only attempt load once per modal open
    if (hasAttemptedLoad) {
      return;
    }

    const loadAgentConversations = async () => {
      if (!activeAgentId) {
        setError("No agent specified for history");
        setHasAttemptedLoad(true);
        return;
      }

      if (!agents || agents.length === 0) {
        setError("Agents not loaded yet");
        setHasAttemptedLoad(true);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setHasAttemptedLoad(true);

        // Find the specific agent
        const agent = agents.find(a => a.id === activeAgentId);
        if (!agent) {
          throw new Error(`Agent with ID ${activeAgentId} not found`);
        }

        console.log(`📚 Loading history for agent: ${agent.name} (${agent.id})`);

        // Get projects for this specific agent
        const agentProjects = await remoteHistory.fetchAgentProjects(agent.apiEndpoint);
        console.log(`📁 Found ${agentProjects.length} projects for agent ${agent.name}`);
        
        // Collect all conversations from all projects for this agent
        const allAgentConversations: ConversationSummary[] = [];
        
        for (const project of agentProjects) {
          try {
            console.log(`📖 Loading conversations from project: ${project.path}`);
            const projectHistories = await remoteHistory.fetchAgentHistories(
              agent.apiEndpoint, 
              project.encodedName
            );
            console.log(`💬 Found ${projectHistories.length} conversations in project ${project.path}`);
            allAgentConversations.push(...projectHistories);
          } catch (projectError) {
            console.warn(`Failed to load project ${project.path} for agent ${agent.name}:`, projectError);
          }
        }
        
        setAllAgentConversations([{
          agentId: agent.id,
          agentName: agent.name,
          conversations: allAgentConversations,
          isLocal: false,
        }]);
        
        // Single agent view, no tabs needed
        
        console.log(`✅ Loaded ${allAgentConversations.length} total conversations for agent ${agent.name}`);
        
      } catch (err) {
        console.error("❌ Failed to load agent conversations:", err);
        setError(err instanceof Error ? err.message : "Failed to load conversations");
      } finally {
        setLoading(false);
      }
    };

    loadAgentConversations();
  }, [isOpen, activeAgentId, agents, remoteHistory, hasAttemptedLoad]);

  const handleConversationSelect = (sessionId: string) => {
    // Pass the active agent ID since we're viewing a specific agent's history
    onConversationSelect(sessionId, activeAgentId);
    onClose();
  };

  const activeAgentData = allAgentConversations[0]; // Single agent, just get the first (and only) entry

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {activeAgentId ? `${agents?.find(a => a.id === activeAgentId)?.name || 'Agent'} History` : 'Conversation History'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Loading conversations...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-slate-800 dark:text-slate-100 text-lg font-semibold mb-2">
                Error Loading History
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Conversations List */}
            <div className="flex-1 overflow-hidden p-6">
              {allAgentConversations.length === 0 || allAgentConversations.every(ac => ac.conversations.length === 0) ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-slate-800 dark:text-slate-100 text-xl font-semibold mb-2">
                      No Conversations Yet
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm">
                      Start chatting with this agent to see conversation history here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 h-full overflow-y-auto">
                  {activeAgentData?.conversations.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-600 dark:text-slate-400">
                        No conversations found for {activeAgentData.agentName}
                      </p>
                    </div>
                  ) : (
                    activeAgentData?.conversations.map((conversation) => (
                      <div
                        key={conversation.sessionId}
                        onClick={() => handleConversationSelect(
                          conversation.sessionId
                        )}
                        className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                Session: {conversation.sessionId.substring(0, 8)}...
                              </h3>
                              {!activeAgentData.isLocal && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                  Remote
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {new Date(conversation.startTime).toLocaleString()} •{" "}
                              {conversation.messageCount} messages
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                              {conversation.lastMessagePreview}
                            </p>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}