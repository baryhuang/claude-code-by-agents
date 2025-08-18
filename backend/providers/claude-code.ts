import { query, AbortError } from "@anthropic-ai/claude-code";
import type {
  AgentProvider,
  ProviderChatRequest,
  ProviderOptions,
  ProviderResponse,
} from "./types.ts";
import { prepareClaudeAuthEnvironment, writeClaudeCredentialsFile } from "../auth/claude-auth-utils.ts";

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
      
      // Prepare authentication environment
      let authEnv: Record<string, string> = {};
      let executableArgs: string[] = [];
      
      try {
        // Write credentials file first
        await writeClaudeCredentialsFile();
        
        // Prepare auth environment
        const authEnvironment = await prepareClaudeAuthEnvironment();
        authEnv = authEnvironment.env;
        executableArgs = authEnvironment.executableArgs;
        
        if (debugMode && Object.keys(authEnv).length > 0) {
          console.debug("[Claude Code] Using OAuth authentication");
        }
      } catch (authError) {
        console.warn("[Claude Code] Failed to prepare auth environment:", authError);
        // Continue without auth - will fall back to system credentials
      }
      
      // Apply auth environment to process.env temporarily
      const originalEnv: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(authEnv)) {
        originalEnv[key] = process.env[key];
        process.env[key] = value;
      }
      
      try {
        // Execute Claude Code query
        for await (const sdkMessage of query({
          prompt: processedMessage,
          options: {
            abortController,
            executable: "node" as const,
            executableArgs: executableArgs,
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
            // Extract content based on actual SDK message structure
            const messageData = sdkMessage as any;
            let content = "";
            
            if (messageData.message?.content) {
              if (Array.isArray(messageData.message.content)) {
                content = messageData.message.content.map((c: any) => 
                  typeof c === "string" ? c : 
                  c.type === "text" ? c.text : 
                  JSON.stringify(c)
                ).join("");
              } else if (typeof messageData.message.content === "string") {
                content = messageData.message.content;
              } else {
                content = JSON.stringify(messageData.message.content);
              }
            } else {
              content = JSON.stringify(messageData);
            }
              
            yield {
              type: "text",
              content,
              metadata: {
                model: messageData.model,
              },
            };
          }
          
          // Handle tool use - check if the message contains tool use information
          if ((sdkMessage as any).message?.content) {
            const messageContent = (sdkMessage as any).message.content;
            if (Array.isArray(messageContent)) {
              for (const contentItem of messageContent) {
                if (contentItem.type === "tool_use") {
                  yield {
                    type: "tool_use",
                    toolName: contentItem.name,
                    toolInput: contentItem.input,
                  };
                }
              }
            }
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
                  model: (sdkMessage as any).model,
                },
              };
            }
          }
        }
        
        yield { type: "done" };
      } finally {
        // Restore original environment variables
        for (const [key, originalValue] of Object.entries(originalEnv)) {
          if (originalValue === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = originalValue;
          }
        }
      }
      
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