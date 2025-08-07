export interface AgentProvider {
  readonly id: string;
  readonly name: string;
  readonly type: "openai" | "anthropic" | "claude-code";
  
  /**
   * Execute a chat request with this provider
   * @param request - The chat request
   * @param options - Provider-specific options
   * @returns Async generator of streaming responses
   */
  executeChat(
    request: ProviderChatRequest,
    options?: ProviderOptions
  ): AsyncGenerator<ProviderResponse>;
  
  /**
   * Check if provider supports image analysis
   */
  supportsImages(): boolean;
}

export interface ProviderChatRequest {
  message: string;
  sessionId?: string;
  requestId: string;
  workingDirectory?: string;
  images?: ProviderImage[];
  context?: ProviderContext[];
}

export interface ProviderImage {
  type: "base64" | "url";
  data: string; // base64 data or URL
  mimeType: string; // image/png, image/jpeg, etc.
}

export interface ProviderContext {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface ProviderOptions {
  debugMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  abortController?: AbortController;
}

export interface ProviderResponse {
  type: "text" | "image" | "tool_use" | "error" | "done";
  content?: string;
  imageData?: string; // base64 for images
  toolName?: string;
  toolInput?: unknown;
  error?: string;
  metadata?: {
    model?: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
}

// Chat room protocol messages
export interface ChatRoomMessage {
  type: "text" | "image" | "command" | "analysis" | "implementation";
  content: string;
  imageData?: string; // base64 encoded image
  agentId: string;
  timestamp: string;
  metadata?: {
    command?: string; // For command type messages
    analysisType?: "ux" | "design" | "technical"; // For analysis type
    implementationType?: "frontend" | "backend" | "fullstack"; // For implementation type
  };
}

// Structured commands for agent coordination
export interface AgentCommand {
  command: "capture_screen" | "analyze_image" | "implement_changes" | "review_code";
  target?: string; // file path, URL, or element selector
  parameters?: Record<string, unknown>;
}