import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ConversationSummary } from "../../../shared/types";
import { getHistoriesUrl } from "../config/api";
import { useAgentConfig } from "../hooks/useAgentConfig";
import { useRemoteAgentHistory } from "../hooks/useRemoteAgentHistory";

interface EnhancedHistoryViewProps {
  workingDirectory: string;
  encodedName: string | null;
  onBack: () => void;
}

interface AgentConversations {
  agentId: string;
  agentName: string;
  conversations: ConversationSummary[];
  isLocal: boolean;
}

export function EnhancedHistoryView({ encodedName }: EnhancedHistoryViewProps) {
  const navigate = useNavigate();
  const [allAgentConversations, setAllAgentConversations] = useState<AgentConversations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("local");
  
  const { getOrchestratorAgent, agents } = useAgentConfig();
  const remoteHistory = useRemoteAgentHistory();

  useEffect(() => {
    const loadAllConversations = async () => {
      if (!encodedName) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const allConversations: AgentConversations[] = [];

        // Load local (orchestrator) conversations
        try {
          const orchestratorAgent = getOrchestratorAgent();
          const localResponse = await fetch(getHistoriesUrl(encodedName, orchestratorAgent?.apiEndpoint));
          
          if (localResponse.ok) {
            const localData = await localResponse.json();
            allConversations.push({
              agentId: "local",
              agentName: "Local Agent",
              conversations: localData.conversations || [],
              isLocal: true,
            });
          }
        } catch (localError) {
          console.warn("Failed to load local conversations:", localError);
        }

        // Load remote agent conversations
        const remoteAgents = agents.filter(agent => !agent.isOrchestrator);
        
        for (const agent of remoteAgents) {
          try {
            // First, get projects for this agent
            const agentProjects = await remoteHistory.fetchAgentProjects(agent.apiEndpoint);
            
            // Find the project that matches our encodedName
            const matchingProject = agentProjects.find(p => p.encodedName === encodedName);
            
            if (matchingProject) {
              // Fetch histories for this project
              const agentHistories = await remoteHistory.fetchAgentHistories(
                agent.apiEndpoint, 
                matchingProject.encodedName
              );
              
              allConversations.push({
                agentId: agent.id,
                agentName: agent.name,
                conversations: agentHistories,
                isLocal: false,
              });
            }
          } catch (agentError) {
            console.warn(`Failed to load conversations for agent ${agent.name}:`, agentError);
            // Add empty entry for failed agents so user knows they exist
            allConversations.push({
              agentId: agent.id,
              agentName: agent.name,
              conversations: [],
              isLocal: false,
            });
          }
        }

        setAllAgentConversations(allConversations);
        
        // Set default active tab to first agent with conversations, or local
        const firstWithConversations = allConversations.find(ac => ac.conversations.length > 0);
        if (firstWithConversations) {
          setActiveTab(firstWithConversations.agentId);
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load conversations");
      } finally {
        setLoading(false);
      }
    };

    loadAllConversations();
  }, [encodedName, agents, remoteHistory, getOrchestratorAgent]);

  const handleConversationSelect = (sessionId: string, isLocal: boolean, agentId?: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set("sessionId", sessionId);
    if (!isLocal && agentId) {
      searchParams.set("agentId", agentId);
    }
    navigate({ search: searchParams.toString() });
  };

  const activeAgentData = allAgentConversations.find(ac => ac.agentId === activeTab);

  if (loading || !encodedName) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">
            {!encodedName ? "Loading project..." : "Loading conversations..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-slate-800 dark:text-slate-100 text-xl font-semibold mb-2">
            Error Loading History
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (allAgentConversations.length === 0 || allAgentConversations.every(ac => ac.conversations.length === 0)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-slate-800 dark:text-slate-100 text-xl font-semibold mb-2">
            No Conversations Yet
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm">
            Start chatting with agents to see your conversation history here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6 h-full flex flex-col">
        {/* Agent Tabs */}
        <div className="flex space-x-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {allAgentConversations.map((agentData) => (
            <button
              key={agentData.agentId}
              onClick={() => setActiveTab(agentData.agentId)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex-1 ${
                activeTab === agentData.agentId
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>{agentData.agentName}</span>
                <span className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">
                  {agentData.conversations.length}
                </span>
                {!agentData.isLocal && (
                  <span className="text-xs text-blue-500">🌐</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Conversations List */}
        <div className="grid gap-4 flex-1 overflow-y-auto">
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
                  conversation.sessionId, 
                  activeAgentData.isLocal, 
                  activeAgentData.agentId
                )}
                className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer shadow-sm hover:shadow-md"
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
      </div>
    </div>
  );
}