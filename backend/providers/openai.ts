import OpenAI from "openai";
import type {
  AgentProvider,
  ProviderChatRequest,
  ProviderOptions,
  ProviderResponse,
} from "./types.ts";

export class OpenAIProvider implements AgentProvider {
  readonly id = "openai";
  readonly name = "OpenAI GPT";
  readonly type = "openai" as const;
  
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
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
        console.debug(`[OpenAI] Executing chat request:`, {
          message: request.message.substring(0, 100) + "...",
          hasImages: !!request.images?.length,
          imagesCount: request.images?.length || 0,
        });
      }
      
      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      
      // Add system message for UX analysis role
      messages.push({
        role: "system",
        content: `You are a UX designer and design critic. Your role is to analyze user interfaces and provide detailed, actionable feedback.

When analyzing screenshots:
1. **Visual Hierarchy**: Comment on layout, spacing, typography hierarchy
2. **User Experience**: Identify usability issues, navigation problems, accessibility concerns  
3. **Design Quality**: Evaluate color choices, consistency, visual appeal
4. **Improvement Suggestions**: Provide specific, implementable recommendations

Format your responses with clear sections and actionable recommendations. Be constructive and specific in your feedback.`
      });
      
      // Add context messages if provided
      if (request.context) {
        for (const contextMsg of request.context) {
          messages.push({
            role: contextMsg.role as "user" | "assistant" | "system",
            content: contextMsg.content,
          });
        }
      }
      
      // Build user message with text and images
      const userContent: Array<OpenAI.Chat.ChatCompletionContentPart> = [
        { type: "text", text: request.message }
      ];
      
      // Add images if provided
      if (request.images) {
        for (const image of request.images) {
          if (image.type === "base64") {
            userContent.push({
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.data}`,
                detail: "high"
              }
            });
          } else if (image.type === "url") {
            userContent.push({
              type: "image_url", 
              image_url: {
                url: image.data,
                detail: "high"
              }
            });
          }
        }
      }
      
      messages.push({
        role: "user",
        content: userContent,
      });
      
      // Create streaming completion
      const stream = await this.client.chat.completions.create({
        model: "gpt-4o", // Use GPT-4 with vision capabilities
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });
      
      let accumulatedContent = "";
      
      for await (const chunk of stream) {
        if (options.abortController?.signal.aborted) {
          yield { type: "error", error: "Request aborted" };
          return;
        }
        
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          accumulatedContent += delta.content;
          
          yield {
            type: "text",
            content: delta.content,
            metadata: {
              model: chunk.model,
            },
          };
        }
        
        // Handle finish reason
        if (chunk.choices[0]?.finish_reason) {
          if (debugMode) {
            console.debug(`[OpenAI] Stream finished:`, {
              reason: chunk.choices[0].finish_reason,
              totalContent: accumulatedContent.length,
            });
          }
          
          yield {
            type: "done",
            metadata: {
              model: chunk.model,
            },
          };
          return;
        }
      }
      
      yield { type: "done" };
      
    } catch (error) {
      if (options.debugMode) {
        console.error(`[OpenAI] Chat execution failed:`, error);
      }
      
      yield {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}