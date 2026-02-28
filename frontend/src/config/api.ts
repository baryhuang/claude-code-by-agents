// API configuration - uses orchestrator agent settings
export const API_CONFIG = {
  ENDPOINTS: {
    CHAT: "/api/chat",
    ABORT: "/api/abort",
    PROJECTS: "/api/projects",
    HISTORIES: "/api/projects",
    CONVERSATIONS: "/api/projects",
    // Remote agent history endpoints
    AGENT_PROJECTS: "/api/agent-projects",
    AGENT_HISTORIES: "/api/agent-histories",
    AGENT_CONVERSATIONS: "/api/agent-conversations",
  },
} as const;

// Helper function to get full API URL using agent endpoint configuration
export const getApiUrl = (endpoint: string, agentEndpoint?: string) => {
  // In development, Vite proxies /api to the local backend — use relative paths
  if (import.meta.env.DEV) {
    return endpoint;
  }

  // In production (Electron), use the agent's configured endpoint
  const baseUrl = agentEndpoint || "http://localhost:8080";
  return `${baseUrl}${endpoint}`;
};

// Helper function to get abort URL
export const getAbortUrl = (requestId: string, orchestratorEndpoint?: string) => {
  return getApiUrl(`${API_CONFIG.ENDPOINTS.ABORT}/${requestId}`, orchestratorEndpoint);
};

// Helper function to get chat URL
export const getChatUrl = (orchestratorEndpoint?: string) => {
  return getApiUrl(API_CONFIG.ENDPOINTS.CHAT, orchestratorEndpoint);
};

// Helper function to get projects URL
export const getProjectsUrl = (orchestratorEndpoint?: string) => {
  return getApiUrl(API_CONFIG.ENDPOINTS.PROJECTS, orchestratorEndpoint);
};

// Helper function to get histories URL
export const getHistoriesUrl = (projectPath: string, orchestratorEndpoint?: string) => {
  const encodedPath = encodeURIComponent(projectPath);
  return getApiUrl(`${API_CONFIG.ENDPOINTS.HISTORIES}/${encodedPath}/histories`, orchestratorEndpoint);
};

// Helper function to get conversation URL
export const getConversationUrl = (
  encodedProjectName: string,
  sessionId: string,
  orchestratorEndpoint?: string,
) => {
  return getApiUrl(`${API_CONFIG.ENDPOINTS.CONVERSATIONS}/${encodedProjectName}/histories/${sessionId}`, orchestratorEndpoint);
};

// Remote agent history helper functions
export const getAgentProjectsUrl = (agentEndpoint: string) => {
  return `${agentEndpoint}${API_CONFIG.ENDPOINTS.AGENT_PROJECTS}`;
};

export const getAgentHistoriesUrl = (agentEndpoint: string, projectPath: string, agentId?: string) => {
  const encodedPath = encodeURIComponent(projectPath);
  const baseUrl = `${agentEndpoint}${API_CONFIG.ENDPOINTS.AGENT_HISTORIES}/${encodedPath}`;
  if (agentId) {
    return `${baseUrl}?agentId=${encodeURIComponent(agentId)}`;
  }
  return baseUrl;
};

export const getAgentConversationUrl = (
  agentEndpoint: string,
  encodedProjectName: string,
  sessionId: string,
) => {
  return `${agentEndpoint}${API_CONFIG.ENDPOINTS.AGENT_CONVERSATIONS}/${encodedProjectName}/${sessionId}`;
};
