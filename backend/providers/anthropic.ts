import type {
  AgentProvider,
  ProviderChatRequest,
  ProviderOptions,
  ProviderResponse,
} from "./types.ts";

export class AnthropicProvider implements AgentProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic Claude";
  readonly type = "anthropic" as const;
  
  private apiKey: string;
  private baseUrl = "https://api.anthropic.com/v1/messages";
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  supportsImages(): boolean {
    return true;
  }
  
  async* executeChat(
    request: ProviderChatRequest,
    options: ProviderOptions = {}
  ): AsyncGenerator<ProviderResponse> {
    try {
      const { debugMode, temperature = 0.7, maxTokens = 4000 } = options;
      
      if (debugMode) {
        console.debug(`[Anthropic] Executing chat request:`, {
          message: request.message.substring(0, 100) + "...",
          hasImages: !!request.images?.length,
          imagesCount: request.images?.length || 0,
        });
      }
      
      // Build messages array
      const messages: any[] = [];
      
      // Add context messages if provided
      if (request.context) {
        for (const contextMsg of request.context) {
          messages.push({
            role: contextMsg.role === "assistant" ? "assistant" : "user",
            content: contextMsg.content,
          });
        }
      }
      
      // Build user message with text and images
      const userContent: any[] = [
        { type: "text", text: request.message }
      ];
      
      // Add images if provided
      if (request.images) {
        for (const image of request.images) {
          if (image.type === "base64") {
            userContent.push({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: image.data,
              }
            });
          }
        }
      }
      
      messages.push({
        role: "user",
        content: userContent,
      });
      
      // Create streaming request
      const requestBody = {
        model: "claude-sonnet-4-20250514",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        system: "You are Claude, a helpful AI assistant created by Anthropic. You help users coordinate multiple AI agents working on different parts of projects, each with specialized skills and access to different codebases. When working in orchestrator mode, you help plan and coordinate tasks across multiple agents."
      };
      
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
        signal: options.abortController?.signal,
      });
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error("No response body received from Anthropic API");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      try {
        while (true) {
          if (options.abortController?.signal.aborted) {
            yield { type: "error", error: "Request aborted" };
            return;
          }
          
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // Keep incomplete line in buffer
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              
              if (data === '[DONE]') {
                yield { type: "done" };
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  yield {
                    type: "text",
                    content: parsed.delta.text,
                    metadata: {
                      model: requestBody.model,
                    },
                  };
                } else if (parsed.type === "message_stop") {
                  if (debugMode) {
                    console.debug(`[Anthropic] Stream finished`);
                  }
                  
                  yield {
                    type: "done",
                    metadata: {
                      model: requestBody.model,
                    },
                  };
                  return;
                } else if (parsed.type === "error") {
                  yield {
                    type: "error",
                    error: parsed.error?.message || "Unknown Anthropic API error",
                  };
                  return;
                }
              } catch {
                if (debugMode) {
                  console.warn(`[Anthropic] Failed to parse SSE data:`, data);
                }
              }
            }
          }
        }
        
        yield { type: "done" };
        
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      if (options.debugMode) {
        console.error(`[Anthropic] Chat execution failed:`, error);
      }
      
      yield {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}