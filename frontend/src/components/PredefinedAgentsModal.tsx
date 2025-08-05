import { useState, useMemo } from "react";
import { 
  PREDEFINED_AGENTS_LIBRARY, 
  AgentCategory, 
  PredefinedAgent,
  getAgentsByCategory,
  getAgentsByDifficulty,
  searchAgents,
  getPopularTags,
  convertPredefinedToAgent
} from "../config/predefinedAgents";

interface PredefinedAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agent: PredefinedAgent, customEndpoint?: string) => void;
}

export function PredefinedAgentsModal({ isOpen, onClose, onSelectAgent }: PredefinedAgentsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<PredefinedAgent | null>(null);

  const popularTags = useMemo(() => getPopularTags(), []);

  const filteredAgents = useMemo(() => {
    let agents = PREDEFINED_AGENTS_LIBRARY;

    // Filter by search query and tags
    if (searchQuery || selectedTags.length > 0) {
      agents = searchAgents(searchQuery, selectedTags);
    }

    // Filter by category
    if (selectedCategory !== "all") {
      agents = agents.filter(agent => agent.category === selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== "all") {
      agents = agents.filter(agent => agent.difficulty === selectedDifficulty);
    }

    return agents;
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedTags]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    Object.values(AgentCategory).forEach(category => {
      stats[category] = getAgentsByCategory(category).length;
    });
    return stats;
  }, []);

  const difficultyStats = useMemo(() => {
    return {
      beginner: getAgentsByDifficulty("beginner").length,
      intermediate: getAgentsByDifficulty("intermediate").length,
      advanced: getAgentsByDifficulty("advanced").length,
    };
  }, []);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedDifficulty("all");
    setSelectedTags([]);
  };

  const handleSelectAgent = (agent: PredefinedAgent) => {
    setSelectedAgent(agent);
  };

  const handleConfirmSelection = () => {
    if (selectedAgent) {
      onSelectAgent(selectedAgent, customEndpoint || undefined);
      onClose();
      setSelectedAgent(null);
      setCustomEndpoint("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Predefined Agents Library
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Choose from our curated collection of specialized AI agents
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Filters */}
          <div className="w-80 p-6 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            {/* Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Agents
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, description, or capabilities..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as AgentCategory | "all")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Categories ({PREDEFINED_AGENTS_LIBRARY.length})</option>
                {Object.values(AgentCategory).map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)} ({categoryStats[category]})
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Difficulty Level
              </label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as "all" | "beginner" | "intermediate" | "advanced")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner ({difficultyStats.beginner})</option>
                <option value="intermediate">Intermediate ({difficultyStats.intermediate})</option>
                <option value="advanced">Advanced ({difficultyStats.advanced})</option>
              </select>
            </div>

            {/* Popular Tags */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Popular Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {popularTags.slice(0, 12).map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      selectedTags.includes(tag)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {(searchQuery || selectedCategory !== "all" || selectedDifficulty !== "all" || selectedTags.length > 0) && (
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Clear All Filters
              </button>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {selectedAgent ? (
              /* Agent Details View */
              <div className="p-6">
                <div className="mb-6">
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to library
                  </button>

                  <div className="flex items-start space-x-4">
                    <div className={`text-4xl p-3 rounded-lg ${selectedAgent.color}`}>
                      {selectedAgent.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {selectedAgent.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {selectedAgent.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className={`px-2 py-1 rounded-md text-white ${
                          selectedAgent.difficulty === "beginner" ? "bg-green-500" :
                          selectedAgent.difficulty === "intermediate" ? "bg-yellow-500" : "bg-red-500"
                        }`}>
                          {selectedAgent.difficulty}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {selectedAgent.category.charAt(0).toUpperCase() + selectedAgent.category.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Specialization</h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedAgent.specialization}</p>

                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Capabilities</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedAgent.capabilities.map(capability => (
                        <span 
                          key={capability}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md"
                        >
                          {capability}
                        </span>
                      ))}
                    </div>

                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Example Tasks</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {selectedAgent.exampleTasks.map((task, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    {selectedAgent.prerequisites && (
                      <>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Prerequisites</h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                          {selectedAgent.prerequisites.map((prereq, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-orange-500 mr-2">⚠</span>
                              {prereq}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {selectedAgent.setupInstructions && (
                      <>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Setup Instructions</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{selectedAgent.setupInstructions}</p>
                      </>
                    )}

                    {selectedAgent.usageNotes && (
                      <>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Usage Notes</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAgent.usageNotes}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Configuration */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Configuration</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Endpoint (Optional)
                      </label>
                      <input
                        type="text"
                        value={customEndpoint}
                        onChange={(e) => setCustomEndpoint(e.target.value)}
                        placeholder={selectedAgent.defaultApiEndpoint}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Leave empty to use default: {selectedAgent.defaultApiEndpoint}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Add Agent Button */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSelection}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
                  >
                    Add Agent
                  </button>
                </div>
              </div>
            ) : (
              /* Agent Grid View */
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} found
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAgents.map(agent => (
                    <div
                      key={agent.id}
                      onClick={() => handleSelectAgent(agent)}
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer transition-colors hover:shadow-md"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`text-2xl p-2 rounded-lg ${agent.color}`}>
                          {agent.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {agent.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                            {agent.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className={`px-2 py-1 text-xs rounded-md text-white ${
                              agent.difficulty === "beginner" ? "bg-green-500" :
                              agent.difficulty === "intermediate" ? "bg-yellow-500" : "bg-red-500"
                            }`}>
                              {agent.difficulty}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {agent.category}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {agent.tags.slice(0, 3).map(tag => (
                              <span 
                                key={tag}
                                className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {agent.tags.length > 3 && (
                              <span className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                                +{agent.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredAgents.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">🔍</div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No agents found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Try adjusting your search criteria or filters.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}