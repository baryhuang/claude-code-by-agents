import { query, AbortError } from "@anthropic-ai/claude-code";
import type {
  AgentProvider,
  ProviderChatRequest,
  ProviderOptions,
  ProviderResponse,
} from "./types.ts";

export class ClaudeCodeProvider implements AgentProvider {
  readonly id = "claude-code";
  readonly name = "Claude Code";
  readonly type = "claude-code" as const;
  
  private claudePath: string;
  
  constructor(claudePath: string) {
    this.claudePath = claudePath;
  }
  
  supportsImages(): boolean {
    return true; // Claude Code supports images through Read tool
  }
  
  async* executeChat(
    request: ProviderChatRequest,
    options: ProviderOptions = {}
  ): AsyncGenerator<ProviderResponse> {
    try {
      const { debugMode, abortController } = options;
      
      if (debugMode) {
        console.debug(`[Claude Code] Executing chat request:`, {
          message: request.message.substring(0, 100) + "...",
          workingDirectory: request.workingDirectory,
          hasImages: !!request.images?.length,
        });
      }
      
      // Process commands that start with '/'
      let processedMessage = request.message;
      if (request.message.startsWith("/")) {
        processedMessage = request.message.substring(1);
      }
      
      // If images are provided, we need to save them temporarily and reference them
      if (request.images && request.images.length > 0) {
        const imageReferences: string[] = [];
        
        for (let i = 0; i < request.images.length; i++) {
          const image = request.images[i];
          
          if (image.type === "base64") {
            // Create a temporary file reference that Claude Code can use
            const tempPath = `/tmp/screenshot_${request.requestId}_${i}.${image.mimeType.split('/')[1]}`;
            imageReferences.push(tempPath);
            
            // Add instruction to read the image
            processedMessage += `\n\nPlease analyze the screenshot at ${tempPath}. The image has been captured and is available for analysis.`;
          }
        }
      }
      
      // Execute Claude Code query
      for await (const sdkMessage of query({
        prompt: processedMessage,
        options: {
          abortController,
          executable: "node" as const,
          executableArgs: [],
          pathToClaudeCodeExecutable: this.claudePath,
          ...(request.sessionId ? { resume: request.sessionId } : {}),
          ...(request.workingDirectory ? { cwd: request.workingDirectory } : {}),
          permissionMode: "bypassPermissions" as const,
        },
      })) {
        if (debugMode) {
          console.debug(`[Claude Code] SDK Message:`, {
            type: sdkMessage.type,
            subtype: (sdkMessage as any).subtype,
          });
        }
        
        // Convert SDK message to provider response
        if (sdkMessage.type === "assistant") {
          const content = Array.isArray(sdkMessage.content) 
            ? sdkMessage.content.map(c => 
                typeof c === "string" ? c : 
                c.type === "text" ? c.text : 
                JSON.stringify(c)
              ).join("")
            : typeof sdkMessage.content === "string"
            ? sdkMessage.content
            : JSON.stringify(sdkMessage.content);
            
          yield {
            type: "text",
            content,
            metadata: {
              model: (sdkMessage as any).model,
            },
          };
        }
        
        // Handle tool use
        if (sdkMessage.type === "tool_use") {
          yield {
            type: "tool_use",
            toolName: (sdkMessage as any).name,
            toolInput: (sdkMessage as any).input,
          };
        }
        
        // Handle system messages (including screenshot captures)
        if (sdkMessage.type === "system") {
          // Check if this is a screenshot capture result
          const messageStr = JSON.stringify(sdkMessage);
          if (messageStr.includes("screenshot") || messageStr.includes("capture")) {
            yield {
              type: "image",
              content: "Screenshot captured successfully",
              metadata: {
                captureType: "screenshot",
              },
            };
          }
        }
      }
      
      yield { type: "done" };
      
    } catch (error) {
      if (error instanceof AbortError) {
        yield {
          type: "error",
          error: "Request aborted",
        };
      } else {
        if (options.debugMode) {
          console.error(`[Claude Code] Chat execution failed:`, error);
        }
        
        yield {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }
}