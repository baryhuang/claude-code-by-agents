import { describe, it, expect, vi, beforeEach } from "vitest";
import { Context } from "hono";
import { handleMultiAgentChatRequest } from "../../handlers/multiAgentChat.ts";
import { globalRegistry } from "../../providers/registry.ts";
import { globalImageHandler } from "../../utils/imageHandling.ts";
import type { ChatRequest } from "../../../shared/types.ts";

// Mock the registry and image handler
vi.mock("../../providers/registry.ts", () => ({
  globalRegistry: {
    getProviderForAgent: vi.fn(),
    getAgent: vi.fn(),
  },
}));

vi.mock("../../utils/imageHandling.ts", () => ({
  globalImageHandler: {
    captureScreenshot: vi.fn(),
  },
}));

// Mock provider for testing
const mockProvider = {
  id: "test-provider",
  name: "Test Provider",
  type: "openai" as const,
  supportsImages: () => true,
  executeChat: vi.fn(),
};

const mockAgent = {
  id: "test-agent",
  name: "Test Agent",
  description: "Test agent for unit tests",
  provider: "test-provider",
  config: {
    temperature: 0.7,
    maxTokens: 1000,
  },
};

describe("handleMultiAgentChatRequest", () => {
  let mockContext: Partial<Context>;
  let requestAbortControllers: Map<string, AbortController>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    requestAbortControllers = new Map();
    
    mockContext = {
      req: {
        json: vi.fn(),
      } as any,
      var: {
        config: {
          debugMode: true,
        },
      } as any,
    };
    
    // Setup default mocks
    vi.mocked(globalRegistry.getProviderForAgent).mockReturnValue(mockProvider);
    vi.mocked(globalRegistry.getAgent).mockReturnValue(mockAgent);
  });
  
  it("should handle single agent mention", async () => {
    const chatRequest: ChatRequest = {
      message: "@test-agent analyze this interface",
      requestId: "req-123",
      sessionId: "session-456",
    };
    
    vi.mocked(mockContext.req!.json).mockResolvedValue(chatRequest);
    
    // Mock provider response
    const mockResponses = [
      { type: "text" as const, content: "I can see the interface has..." },
      { type: "done" as const },
    ];
    
    vi.mocked(mockProvider.executeChat).mockImplementation(async function* () {
      for (const response of mockResponses) {
        yield response;
      }
    });
    
    const response = await handleMultiAgentChatRequest(
      mockContext as Context,
      requestAbortControllers
    );
    
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson");
    
    // Verify provider was called with correct parameters
    expect(mockProvider.executeChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "@test-agent analyze this interface",
        requestId: "req-123",
        sessionId: "session-456",
      }),
      expect.objectContaining({
        debugMode: true,
        temperature: 0.7,
        maxTokens: 1000,
      })
    );
  });
  
  it("should handle screen capture command", async () => {
    const chatRequest: ChatRequest = {
      message: "@test-agent capture_screen",
      requestId: "req-capture",
      sessionId: "session-capture",
    };
    
    vi.mocked(mockContext.req!.json).mockResolvedValue(chatRequest);
    
    // Mock successful screenshot capture
    vi.mocked(globalImageHandler.captureScreenshot).mockResolvedValue({
      success: true,
      imagePath: "/tmp/screenshot_123.png",
      imageData: "base64-image-data",
      metadata: {
        timestamp: "2023-01-01T00:00:00.000Z",
        format: "png",
        size: { width: 1920, height: 1080 },
      },
    });
    
    const response = await handleMultiAgentChatRequest(
      mockContext as Context,
      requestAbortControllers
    );
    
    expect(globalImageHandler.captureScreenshot).toHaveBeenCalledWith({
      format: "png",
    });
    
    // Read the response stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let streamData = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamData += decoder.decode(value);
    }
    
    const responses = streamData
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    // Should have connection ack, chat room message, completion message, and done
    expect(responses.length).toBeGreaterThanOrEqual(3);
    
    // Find chat room message
    const chatRoomMessage = responses.find(r => 
      r.data?.type === "chat_room_message"
    );
    expect(chatRoomMessage).toBeDefined();
    expect(chatRoomMessage.data.message.type).toBe("image");
    expect(chatRoomMessage.data.message.imageData).toBe("base64-image-data");
    
    // Find completion message
    const completionMessage = responses.find(r => 
      r.data?.content?.includes("SCREENSHOT_CAPTURED")
    );
    expect(completionMessage).toBeDefined();
  });
  
  it("should handle screenshot capture failure", async () => {
    const chatRequest: ChatRequest = {
      message: "@test-agent capture_screen",
      requestId: "req-fail",
    };
    
    vi.mocked(mockContext.req!.json).mockResolvedValue(chatRequest);
    
    // Mock failed screenshot capture
    vi.mocked(globalImageHandler.captureScreenshot).mockResolvedValue({
      success: false,
      error: "Screen capture failed: No display detected",
      metadata: {
        timestamp: "2023-01-01T00:00:00.000Z",
        format: "png",
      },
    });
    
    const response = await handleMultiAgentChatRequest(
      mockContext as Context,
      requestAbortControllers
    );
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let streamData = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamData += decoder.decode(value);
    }
    
    const responses = streamData
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    // Should have an error response
    const errorResponse = responses.find(r => r.type === "error");
    expect(errorResponse).toBeDefined();
    expect(errorResponse.error).toContain("Screenshot capture failed");
  });
  
  it("should handle unknown agent", async () => {
    const chatRequest: ChatRequest = {
      message: "@unknown-agent do something",
      requestId: "req-unknown",
    };
    
    vi.mocked(mockContext.req!.json).mockResolvedValue(chatRequest);
    vi.mocked(globalRegistry.getProviderForAgent).mockReturnValue(undefined);
    
    const response = await handleMultiAgentChatRequest(
      mockContext as Context,
      requestAbortControllers
    );
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let streamData = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamData += decoder.decode(value);
    }
    
    const responses = streamData
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    const errorResponse = responses.find(r => r.type === "error");
    expect(errorResponse).toBeDefined();
    expect(errorResponse.error).toContain("Agent 'unknown-agent' not found");
  });
  
  it("should handle multi-agent orchestration", async () => {
    const chatRequest: ChatRequest = {
      message: "@agent1 @agent2 coordinate to analyze and improve the dashboard",
      requestId: "req-multi",
    };
    
    vi.mocked(mockContext.req!.json).mockResolvedValue(chatRequest);
    
    // Mock orchestrator agent
    const orchestratorAgent = {
      id: "orchestrator",
      name: "Orchestrator",
      description: "Orchestrates multi-agent workflows",
      provider: "claude-code",
      isOrchestrator: true,
    };
    
    vi.mocked(globalRegistry.getAgent).mockImplementation((agentId) => {
      if (agentId === "orchestrator") return orchestratorAgent;
      return mockAgent;
    });
    
    // Mock orchestrator provider response
    const orchestratorResponses = [
      { type: "text" as const, content: "I'll coordinate between agent1 and agent2..." },
      { type: "done" as const },
    ];
    
    vi.mocked(mockProvider.executeChat).mockImplementation(async function* () {
      for (const response of orchestratorResponses) {
        yield response;
      }
    });
    
    await handleMultiAgentChatRequest(
      mockContext as Context,
      requestAbortControllers
    );
    
    // Should have called the orchestrator
    expect(mockProvider.executeChat).toHaveBeenCalled();
  });
  
  it("should handle provider errors gracefully", async () => {
    const chatRequest: ChatRequest = {
      message: "@test-agent analyze interface",
      requestId: "req-error",
    };
    
    vi.mocked(mockContext.req!.json).mockResolvedValue(chatRequest);
    
    // Mock provider error
    vi.mocked(mockProvider.executeChat).mockImplementation(async function* () {
      yield { type: "error" as const, error: "Provider API failed" };
    });
    
    const response = await handleMultiAgentChatRequest(
      mockContext as Context,
      requestAbortControllers
    );
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let streamData = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamData += decoder.decode(value);
    }
    
    const responses = streamData
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    const errorResponse = responses.find(r => r.type === "error");
    expect(errorResponse).toBeDefined();
    expect(errorResponse.error).toBe("Provider API failed");
  });
  
  it("should manage abort controllers correctly", async () => {
    const chatRequest: ChatRequest = {
      message: "@test-agent test request",
      requestId: "req-abort-test",
    };
    
    vi.mocked(mockContext.req!.json).mockResolvedValue(chatRequest);
    
    vi.mocked(mockProvider.executeChat).mockImplementation(async function* () {
      yield { type: "text" as const, content: "Response" };
      yield { type: "done" as const };
    });
    
    await handleMultiAgentChatRequest(
      mockContext as Context,
      requestAbortControllers
    );
    
    // Abort controller should be cleaned up
    expect(requestAbortControllers.has("req-abort-test")).toBe(false);
  });
});