export interface StreamResponse {
  type: "claude_json" | "error" | "done" | "aborted";
  data?: unknown; // SDKMessage object for claude_json type
  error?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  requestId: string;
  allowedTools?: string[];
  workingDirectory?: string;
  availableAgents?: Array<{
    id: string;
    name: string;
    description: string;
    workingDirectory: string;
    apiEndpoint: string;
    isOrchestrator?: boolean;
  }>;
}

export interface AbortRequest {
  requestId: string;
}

export interface ProjectInfo {
  path: string;
  encodedName: string;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
}

// Conversation history types
export interface ConversationSummary {
  sessionId: string;
  startTime: string;
  lastTime: string;
  messageCount: number;
  lastMessagePreview: string;
  agentId?: string; // Agent that created this conversation
}

export interface HistoryListResponse {
  conversations: ConversationSummary[];
}

// Remote agent history types
export interface RemoteAgentProjectsResponse {
  projects: ProjectInfo[];
  agentId: string;
}

export interface RemoteAgentHistoryResponse {
  conversations: ConversationSummary[];
  agentId: string;
}

// Conversation history types
// Note: messages are typed as unknown[] to avoid frontend/backend dependency issues
// Frontend should cast to TimestampedSDKMessage[] (defined in frontend/src/types.ts)
export interface ConversationHistory {
  sessionId: string;
  messages: unknown[]; // TimestampedSDKMessage[] in practice, but avoiding frontend type dependency
  metadata: {
    startTime: string;
    endTime: string;
    messageCount: number;
    agentId?: string; // Agent that created this conversation
  };
}

