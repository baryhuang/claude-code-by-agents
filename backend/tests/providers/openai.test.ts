import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "../../providers/openai.ts";
import type { ProviderChatRequest, ProviderImage } from "../../providers/types.ts";

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;
  let mockCreate: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider("test-api-key");
    
    // Get the mock create function
    const OpenAI = vi.mocked(await import("openai")).default;
    const mockInstance = new OpenAI();
    mockCreate = mockInstance.chat.completions.create;
  });
  
  it("should initialize with correct properties", () => {
    expect(provider.id).toBe("openai");
    expect(provider.name).toBe("OpenAI GPT");
    expect(provider.type).toBe("openai");
    expect(provider.supportsImages()).toBe(true);
  });
  
  it("should execute text-only chat request", async () => {
    // Mock streaming response
    const mockStream = [
      {
        choices: [{ delta: { content: "Hello " } }],
        model: "gpt-4o",
      },
      {
        choices: [{ delta: { content: "world!" } }],
        model: "gpt-4o",
      },
      {
        choices: [{ finish_reason: "stop" }],
        model: "gpt-4o",
      },
    ];
    
    mockCreate.mockResolvedValue(mockStream[Symbol.asyncIterator]());
    
    const request: ProviderChatRequest = {
      message: "Hello, how are you?",
      requestId: "test-123",
    };
    
    const responses: any[] = [];
    for await (const response of provider.executeChat(request, { debugMode: true })) {
      responses.push(response);
    }
    
    expect(responses).toHaveLength(3); // Two text chunks + done
    expect(responses[0]).toMatchObject({
      type: "text",
      content: "Hello ",
      metadata: { model: "gpt-4o" },
    });
    expect(responses[1]).toMatchObject({
      type: "text", 
      content: "world!",
      metadata: { model: "gpt-4o" },
    });
    expect(responses[2]).toMatchObject({
      type: "done",
      metadata: { model: "gpt-4o" },
    });
  });
  
  it("should handle image analysis request", async () => {
    const mockStream = [
      {
        choices: [{ delta: { content: "I can see a user interface with..." } }],
        model: "gpt-4o",
      },
      {
        choices: [{ finish_reason: "stop" }],
        model: "gpt-4o",
      },
    ];
    
    mockCreate.mockResolvedValue(mockStream[Symbol.asyncIterator]());
    
    const testImage: ProviderImage = {
      type: "base64",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      mimeType: "image/png",
    };
    
    const request: ProviderChatRequest = {
      message: "Analyze this screenshot for UX improvements",
      requestId: "test-456",
      images: [testImage],
    };
    
    const responses: any[] = [];
    for await (const response of provider.executeChat(request)) {
      responses.push(response);
    }
    
    expect(responses).toHaveLength(2);
    expect(responses[0].content).toContain("I can see a user interface");
    expect(responses[1].type).toBe("done");
    
    // Verify the API was called with image
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              { type: "text", text: "Analyze this screenshot for UX improvements" },
              expect.objectContaining({
                type: "image_url",
                image_url: expect.objectContaining({
                  url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                  detail: "high",
                }),
              }),
            ]),
          }),
        ]),
      })
    );
  });
  
  it("should include UX analysis system prompt", async () => {
    const mockStream = [
      { choices: [{ finish_reason: "stop" }], model: "gpt-4o" },
    ];
    
    mockCreate.mockResolvedValue(mockStream[Symbol.asyncIterator]());
    
    const request: ProviderChatRequest = {
      message: "Test message",
      requestId: "test-789",
    };
    
    await Array.fromAsync(provider.executeChat(request));
    
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("You are a UX designer and design critic"),
          }),
        ]),
      })
    );
  });
  
  it("should handle context messages", async () => {
    const mockStream = [
      { choices: [{ finish_reason: "stop" }], model: "gpt-4o" },
    ];
    
    mockCreate.mockResolvedValue(mockStream[Symbol.asyncIterator]());
    
    const request: ProviderChatRequest = {
      message: "Continue the analysis",
      requestId: "test-context",
      context: [
        { role: "user", content: "Previous message" },
        { role: "assistant", content: "Previous response" },
      ],
    };
    
    await Array.fromAsync(provider.executeChat(request));
    
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user", content: "Previous message" }),
          expect.objectContaining({ role: "assistant", content: "Previous response" }),
          expect.objectContaining({ role: "user", content: [{ type: "text", text: "Continue the analysis" }] }),
        ]),
      })
    );
  });
  
  it("should handle API errors gracefully", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));
    
    const request: ProviderChatRequest = {
      message: "Test error handling",
      requestId: "test-error",
    };
    
    const responses: any[] = [];
    for await (const response of provider.executeChat(request, { debugMode: true })) {
      responses.push(response);
    }
    
    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      type: "error",
      error: "API rate limit exceeded",
    });
  });
  
  it("should handle abort signal", async () => {
    const abortController = new AbortController();
    
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        // Abort after first chunk
        abortController.abort();
        yield { choices: [{ delta: { content: "Partial" } }], model: "gpt-4o" };
        yield { choices: [{ delta: { content: " response" } }], model: "gpt-4o" };
      },
    };
    
    mockCreate.mockResolvedValue(mockStream);
    
    const request: ProviderChatRequest = {
      message: "Test abort",
      requestId: "test-abort",
    };
    
    const responses: any[] = [];
    for await (const response of provider.executeChat(request, { abortController })) {
      responses.push(response);
    }
    
    // Should get partial response then error
    expect(responses.length).toBeGreaterThanOrEqual(1);
    expect(responses.some(r => r.type === "error" && r.error === "Request aborted")).toBe(true);
  });
});