import { describe, it, expect, vi, beforeEach } from "vitest";
import { globalRegistry } from "../../providers/registry.ts";
import { globalImageHandler } from "../../utils/imageHandling.ts";
import type { 
  ProviderChatRequest, 
  ProviderResponse, 
  ChatRoomMessage 
} from "../../providers/types.ts";

// Mock OpenAI
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

// Mock Claude Code query
vi.mock("@anthropic-ai/claude-code", () => ({
  query: vi.fn(),
  AbortError: class AbortError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AbortError";
    }
  },
}));

describe("Happy Path: UX → Implementation Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Initialize the multi-agent system
    globalRegistry.initializeDefaultProviders({
      openaiApiKey: "test-openai-key",
      claudePath: "/usr/local/bin/claude",
    });
    globalRegistry.createDefaultAgents();
  });
  
  it("should execute the complete UX analysis → implementation workflow", async () => {
    // Step 1: Claude Code agent captures screenshot
    const screenshotCapture = await globalImageHandler.captureScreenshot({
      format: "png",
    });
    
    expect(screenshotCapture.success).toBe(true);
    expect(screenshotCapture.imageData).toBeDefined();
    expect(screenshotCapture.metadata.format).toBe("png");
    
    // Step 2: Create chat room message for screenshot
    const screenshotMessage: ChatRoomMessage = {
      type: "image",
      content: "Screenshot captured for UX analysis",
      imageData: screenshotCapture.imageData,
      agentId: "implementation",
      timestamp: new Date().toISOString(),
    };
    
    expect(screenshotMessage.type).toBe("image");
    expect(screenshotMessage.agentId).toBe("implementation");
    expect(screenshotMessage.imageData).toBeDefined();
    
    // Step 3: UX Designer agent analyzes the screenshot
    const uxProvider = globalRegistry.getProviderForAgent("ux-designer");
    expect(uxProvider).toBeDefined();
    expect(uxProvider!.supportsImages()).toBe(true);
    
    // Mock OpenAI response for UX analysis
    const OpenAI = vi.mocked(await import("openai")).default;
    const mockInstance = new OpenAI();
    const mockCreate = mockInstance.chat.completions.create;
    
    const mockUXAnalysis = [
      {
        choices: [{ delta: { content: "## UX Analysis\n\nI can see several issues with this interface:\n\n1. **Visual Hierarchy**: The navigation lacks clear prioritization..." } }],
        model: "gpt-4o",
      },
      {
        choices: [{ delta: { content: "\n2. **Accessibility**: Missing focus indicators and contrast issues...\n3. **User Flow**: The call-to-action buttons are not prominent enough..." } }],
        model: "gpt-4o",
      },
      {
        choices: [{ finish_reason: "stop" }],
        model: "gpt-4o",
      },
    ];
    
    mockCreate.mockResolvedValue(mockUXAnalysis[Symbol.asyncIterator]());
    
    const uxRequest: ProviderChatRequest = {
      message: "Analyze this screenshot for UX improvements and provide specific recommendations",
      requestId: "ux-analysis-001",
      images: [{
        type: "base64",
        data: screenshotCapture.imageData!,
        mimeType: "image/png",
      }],
    };
    
    const uxResponses: ProviderResponse[] = [];
    for await (const response of uxProvider!.executeChat(uxRequest)) {
      uxResponses.push(response);
    }
    
    expect(uxResponses).toHaveLength(3); // Two text chunks + done
    expect(uxResponses[0].type).toBe("text");
    expect(uxResponses[0].content).toContain("UX Analysis");
    expect(uxResponses[2].type).toBe("done");
    
    // Step 4: Create chat room message for UX analysis
    const uxAnalysisMessage: ChatRoomMessage = {
      type: "analysis",
      content: uxResponses[0].content + uxResponses[1].content,
      agentId: "ux-designer",
      timestamp: new Date().toISOString(),
      metadata: {
        analysisType: "ux",
      },
    };
    
    expect(uxAnalysisMessage.type).toBe("analysis");
    expect(uxAnalysisMessage.agentId).toBe("ux-designer");
    expect(uxAnalysisMessage.content).toContain("Visual Hierarchy");
    expect(uxAnalysisMessage.metadata?.analysisType).toBe("ux");
    
    // Step 5: Implementation agent receives UX feedback and implements changes
    const implProvider = globalRegistry.getProviderForAgent("implementation");
    expect(implProvider).toBeDefined();
    
    // Mock Claude Code response for implementation
    const { query } = vi.mocked(await import("@anthropic-ai/claude-code"));
    const mockImplementationResponse = [
      {
        type: "assistant",
        content: "I'll implement the UX improvements based on your analysis:\n\n1. Improving visual hierarchy by adjusting typography...",
      },
      {
        type: "tool_use",
        name: "Edit",
        input: { file_path: "/src/components/Navigation.tsx", old_string: "old code", new_string: "improved code" },
      },
      {
        type: "assistant",
        content: "✅ Updated navigation component with better visual hierarchy and accessibility improvements.",
      },
    ];
    
    query.mockImplementation(async function* () {
      for (const response of mockImplementationResponse) {
        yield response;
      }
    });
    
    const implRequest: ProviderChatRequest = {
      message: `Implement the following UX improvements: ${uxAnalysisMessage.content}`,
      requestId: "implementation-001",
      workingDirectory: "/tmp/test-project",
    };
    
    const implResponses: ProviderResponse[] = [];
    for await (const response of implProvider!.executeChat(implRequest)) {
      implResponses.push(response);
    }
    
    expect(implResponses.length).toBeGreaterThanOrEqual(2);
    expect(implResponses.some(r => r.type === "text" && r.content?.includes("implement"))).toBe(true);
    expect(implResponses.some(r => r.type === "done")).toBe(true);
    
    // Step 6: Verify the complete workflow
    const workflowMessages = [screenshotMessage, uxAnalysisMessage];
    
    // All messages should have timestamps and agent attribution
    workflowMessages.forEach(msg => {
      expect(msg.timestamp).toBeDefined();
      expect(msg.agentId).toBeDefined();
      expect(msg.content).toBeDefined();
    });
    
    // Should have image → analysis → implementation chain
    expect(workflowMessages[0].type).toBe("image");
    expect(workflowMessages[1].type).toBe("analysis");
    
    // Verify agent coordination
    expect(workflowMessages[0].agentId).toBe("implementation"); // Screenshot taker
    expect(workflowMessages[1].agentId).toBe("ux-designer"); // UX analyzer
  });
  
  it("should handle offline testing without external dependencies", async () => {
    // This test verifies the system works with mocked dependencies
    
    // Initialize image handler
    await globalImageHandler.initialize();
    
    // Capture screenshot (mock implementation)
    const capture = await globalImageHandler.captureScreenshot();
    expect(capture.success).toBe(true);
    
    // Get providers
    const uxProvider = globalRegistry.getProviderForAgent("ux-designer");
    const implProvider = globalRegistry.getProviderForAgent("implementation");
    
    expect(uxProvider).toBeDefined();
    expect(implProvider).toBeDefined();
    
    // Verify provider capabilities
    expect(uxProvider!.supportsImages()).toBe(true);
    expect(implProvider!.supportsImages()).toBe(true);
    
    // Verify agent configurations
    const uxAgent = globalRegistry.getAgent("ux-designer");
    const implAgent = globalRegistry.getAgent("implementation");
    
    expect(uxAgent?.provider).toBe("openai");
    expect(implAgent?.provider).toBe("claude-code");
  });
  
  it("should handle command parsing correctly", async () => {
    // Test various agent command formats
    const testCommands = [
      {
        message: "@implementation capture_screen",
        expectedCommand: "capture_screen",
        expectedTarget: undefined,
      },
      {
        message: "@ux-designer analyze_image /path/to/screenshot.png",
        expectedCommand: "analyze_image", 
        expectedTarget: "/path/to/screenshot.png",
      },
      {
        message: "@implementation implement_changes based on UX feedback",
        expectedCommand: "implement_changes",
        expectedTarget: "based on UX feedback",
      },
      {
        message: "Regular message without commands",
        expectedCommand: null,
        expectedTarget: null,
      },
    ];
    
    // Import the command parser (would need to export it from multiAgentChat.ts)
    // For now, test the pattern matching logic
    testCommands.forEach(({ message, expectedCommand }) => {
      const commandMatch = message.match(/@[\w-]+ (capture_screen|analyze_image|implement_changes|review_code)(?:\s+(.+))?/);
      
      if (expectedCommand) {
        expect(commandMatch).toBeTruthy();
        expect(commandMatch![1]).toBe(expectedCommand);
      } else {
        expect(commandMatch).toBeFalsy();
      }
    });
  });
});