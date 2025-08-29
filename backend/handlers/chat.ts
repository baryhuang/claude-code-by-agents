import { Context } from "hono";
import { AbortError, query } from "@anthropic-ai/claude-code";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatRequest, StreamResponse } from "../../shared/types.ts";
import { prepareClaudeAuthEnvironment, writeClaudeCredentialsFile } from "../auth/claude-auth-utils.ts";
import { globalRegistry } from "../providers/registry.ts";

/**
 * Detects if orchestrator mode should be used
 * @param message - The chat message to check for multi-agent mentions
 * @param availableAgents - Array of available agents
 * @returns true if orchestrator mode should be used
 */
function shouldUseOrchestrator(message: string, availableAgents?: Array<{id: string; name: string; description: string; isOrchestrator?: boolean}>): boolean {
  const orchestratorProvider = globalRegistry.getProviderForAgent("orchestrator");
  
  console.debug(`[DEBUG] shouldUseOrchestrator check:`, {
    message: message.substring(0, 100),
    orchestratorProviderId: orchestratorProvider?.id,
    availableAgentsCount: availableAgents?.length || 0,
    availableAgents: availableAgents?.map(a => a.id) || []
  });
  
  // Only use orchestrator if it's configured to use Anthropic API
  if (orchestratorProvider?.id !== "anthropic") {
    console.debug(`[DEBUG] Orchestrator provider is not 'anthropic', got:`, orchestratorProvider?.id);
    return false;
  }
  
  // Use orchestrator if there are available agents and:
  // ONLY for multiple agent mentions - not for single agent or no mentions
  if (availableAgents && availableAgents.length > 0) {
    const mentionMatches = message.match(/@(\w+(?:-\w+)*)/g);
    const result = mentionMatches && mentionMatches.length > 1;
    console.debug(`[DEBUG] shouldUseOrchestrator result:`, {
      mentionMatches,
      mentionCount: mentionMatches?.length || 0,
      result
    });
    return result;
  }
  
  console.debug(`[DEBUG] No available agents or empty array`);
  return false;
}

/**
 * Executes a request via HTTP to a specific agent's API endpoint
 * @param agent - The target agent with endpoint information
 * @param message - User message
 * @param requestId - Unique request identifier
 * @param requestAbortControllers - Shared map of abort controllers
 * @param sessionId - Optional session ID
 * @param debugMode - Enable debug logging
 * @returns AsyncGenerator yielding StreamResponse objects
 */
async function* executeAgentHttpRequest(
  agent: { id: string; name: string; apiEndpoint: string; workingDirectory: string; },
  message: string,
  requestId: string,
  requestAbortControllers: Map<string, AbortController>,
  sessionId?: string,
  claudeAuth?: ChatRequest['claudeAuth'],
  debugMode?: boolean,
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;

  try {
    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    // Prepare the chat request for the agent's endpoint
    const agentChatRequest: ChatRequest = {
      message: message,
      sessionId: sessionId,
      requestId: requestId,
      workingDirectory: agent.workingDirectory,
      claudeAuth: claudeAuth,
    };

    if (debugMode) {
      console.debug(`[DEBUG] Making HTTP request to agent ${agent.id} at ${agent.apiEndpoint}`);
      console.debug(`[DEBUG] Request payload (OAuth masked):`, {
        ...agentChatRequest,
        claudeAuth: agentChatRequest.claudeAuth ? {
          ...agentChatRequest.claudeAuth,
          accessToken: agentChatRequest.claudeAuth.accessToken ? `${agentChatRequest.claudeAuth.accessToken.substring(0, 10)}...` : undefined,
          refreshToken: agentChatRequest.claudeAuth.refreshToken ? `${agentChatRequest.claudeAuth.refreshToken.substring(0, 10)}...` : undefined
        } : undefined
      });
    }

    // Make HTTP request to the agent's endpoint with timeout
    const response = await fetch(`${agent.apiEndpoint}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(agentChatRequest),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      if (debugMode) {
        console.error(`[DEBUG] Agent HTTP request failed with status ${response.status}:`);
        console.error(`[DEBUG] Error response:`, errorText);
      }
      
      // Provide more specific error messages for authentication issues
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed for agent ${agent.id}. Please check OAuth credentials. Status: ${response.status}`);
      } else if (response.status >= 500) {
        throw new Error(`Agent ${agent.id} server error (${response.status}): ${errorText}`);
      } else {
        throw new Error(`HTTP error from agent ${agent.id}! status: ${response.status} - ${response.statusText}`);
      }
    }

    if (!response.body) {
      throw new Error("No response body from agent endpoint");
    }

    // Stream the response from the agent
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      let timeoutId: number | NodeJS.Timeout | null = null;
      
      while (true) {
        // Add timeout for each read operation
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Stream read timeout after 30 seconds'));
          }, 30000);
        });

        const { done, value } = await Promise.race([readPromise, timeoutPromise]);
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const streamResponse: StreamResponse = JSON.parse(line);
            
            if (debugMode) {
              console.debug(`[DEBUG] Agent response:`, JSON.stringify(streamResponse, null, 2));
            }

            yield streamResponse;

            // If we get a done or error, we can break
            if (streamResponse.type === "done" || streamResponse.type === "error") {
              return;
            }
          } catch (parseError) {
            if (debugMode) {
              console.debug(`[DEBUG] Failed to parse line: ${line}`, parseError);
            }
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  } catch (error) {
    if (debugMode) {
      console.error(`[DEBUG] Agent HTTP request failed:`, error);
    }

    // Check if error is due to abort
    if (error instanceof Error && error.name === 'AbortError') {
      yield { type: "aborted" };
    } else {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
  }
}

/**
 * Executes Orchestrator workflow using direct Anthropic API
 * @param message - User message
 * @param requestId - Unique request identifier
 * @param requestAbortControllers - Shared map of abort controllers
 * @param sessionId - Optional session ID
 * @param debugMode - Enable debug logging
 * @returns AsyncGenerator yielding StreamResponse objects
 */
async function* executeOrchestratorWorkflow(
  message: string,
  requestId: string,
  requestAbortControllers: Map<string, AbortController>,
  sessionId?: string,
  debugMode?: boolean,
  availableAgents?: Array<{
    id: string;
    name: string;
    description: string;
    isOrchestrator?: boolean;
  }>,
  _claudeAuth?: ChatRequest['claudeAuth'],
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;

  try {
    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    // Get worker agents (exclude orchestrator)
    const workerAgents = availableAgents?.filter(agent => !agent.isOrchestrator) || [
      { id: "readymojo-admin", name: "ReadyMojo Admin", description: "Admin dashboard and management interface" },
      { id: "readymojo-api", name: "ReadyMojo API", description: "Backend API and server logic" },
      { id: "readymojo-web", name: "ReadyMojo Web", description: "Frontend web application" },
      { id: "peakmojo-kit", name: "PeakMojo Kit", description: "UI component library and design system" }
    ];


    // For orchestrator mode, always use the API key from environment variables
    // OAuth is for individual agent communication, not orchestrator coordination
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    
    if (debugMode) {
      console.debug(`[DEBUG] Orchestrator using API Key authentication`);
      console.debug(`[DEBUG] API Key available:`, !!apiKey);
    }

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required for orchestrator mode");
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const tools: Anthropic.Tool[] = [
      {
        name: "orchestrate_execution",
        description: "Create a structured execution plan for multi-agent workflows with simple file-based communication. Message to each step must include the full path to files to read from and write to.",
        input_schema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              description: "Array of execution steps to be performed by different agents",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "Unique identifier for this step"
                  },
                  agent: {
                    type: "string",
                    description: "ID of the worker agent that should execute this step",
                    enum: workerAgents.map(agent => agent.id)
                  },
                  message: {
                    type: "string",
                    description: "Clear instruction for the agent. Include file paths to read from previous steps. Include the full path to files to write results to."
                  },
                  output_file: {
                    type: "string", 
                    description: "Path where this agent should save its results (plain text)"
                  },
                  dependencies: {
                    type: "array",
                    description: "Step IDs that must complete before this step can begin",
                    items: {
                      type: "string"
                    }
                  }
                },
                required: ["id", "agent", "message", "output_file"]
              }
            }
          },
          required: ["steps"]
        }
      }
    ];

    const agentDescriptions = workerAgents.map(agent => 
      `- ${agent.id}: ${agent.description}`
    ).join('\n');

    const systemPrompt = `You are the Orchestrator agent. Break user requests into steps where each agent saves results to a plain text file, and the next agent reads from that file.

Rules:
1. Each agent saves results to the specified output_file path
2. Tell subsequent agents exactly which file to read from
3. Use simple paths like "/tmp/step1_results.txt", "/tmp/step2_results.txt"

Available Agents:
${agentDescriptions}

Always use orchestrate_execution tool to create step-by-step plans.`;

    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: message
        }
      ],
      tools,
      tool_choice: { type: "tool", name: "orchestrate_execution" },
      stream: true,
    });

    // Simulate system message for consistency with Claude Code SDK
    yield {
      type: "claude_json",
      data: {
        type: "system",
        subtype: "init",
        session_id: sessionId || `anthropic-${Date.now()}`,
        model: "claude-sonnet-4-20250514",
        tools: ["orchestrate_execution"]
      }
    };

    let currentMessage: any = null;
    let currentContent: any[] = [];

    for await (const chunk of stream) {
      if (debugMode) {
        console.debug("[DEBUG] Anthropic API Chunk:");
        console.debug(JSON.stringify(chunk, null, 2));
        console.debug("---");
      }

      if (chunk.type === "message_start") {
        currentMessage = {
          id: chunk.message.id,
          type: "message",
          role: chunk.message.role,
          model: chunk.message.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: chunk.message.usage
        };
      } else if (chunk.type === "content_block_start") {
        const contentBlock = { ...chunk.content_block };
        // Initialize tool_use input as empty string for JSON accumulation
        if (contentBlock.type === "tool_use") {
          contentBlock.input = "";
        }
        currentContent.push(contentBlock);
      } else if (chunk.type === "content_block_delta") {
        if (chunk.delta.type === "text_delta") {
          const lastContent = currentContent[currentContent.length - 1];
          if (lastContent && lastContent.type === "text") {
            lastContent.text = (lastContent.text || "") + chunk.delta.text;
          }
        } else if (chunk.delta.type === "input_json_delta") {
          const lastContent = currentContent[currentContent.length - 1];
          if (lastContent && lastContent.type === "tool_use") {
            // Ensure input is always a string during accumulation
            if (typeof lastContent.input !== "string") {
              lastContent.input = "";
            }
            lastContent.input += chunk.delta.partial_json;
          }
        }
      } else if (chunk.type === "message_delta") {
        if (currentMessage) {
          currentMessage.stop_reason = chunk.delta.stop_reason;
          currentMessage.stop_sequence = chunk.delta.stop_sequence;
          if (chunk.usage) {
            currentMessage.usage = { ...currentMessage.usage, ...chunk.usage };
          }
        }
      } else if (chunk.type === "content_block_stop") {
        // Parse tool input JSON when content block is complete
        const lastContent = currentContent[currentContent.length - 1];
        if (lastContent && lastContent.type === "tool_use") {
          if (debugMode) {
            console.debug("Content block stopped, input type:", typeof lastContent.input);
            console.debug("Input length:", lastContent.input?.length || 0);
            console.debug("First 100 chars:", typeof lastContent.input === "string" ? lastContent.input.substring(0, 100) : "Not a string");
          }
          
          if (typeof lastContent.input === "string" && lastContent.input.trim()) {
            try {
              lastContent.input = JSON.parse(lastContent.input);
              if (debugMode) {
                console.debug("Successfully parsed tool input JSON");
              }
            } catch (e) {
              if (debugMode) {
                console.error("Failed to parse tool input JSON:", e);
                console.error("Raw input:", lastContent.input);
              }
            }
          }
        }
      } else if (chunk.type === "message_stop") {
        if (currentMessage) {
          currentMessage.content = currentContent;
          
          yield {
            type: "claude_json",
            data: {
              type: "assistant",
              message: currentMessage,
              session_id: sessionId || `anthropic-${Date.now()}`
            }
          };
        }
      }
    }

    yield { type: "done" };
  } catch (error) {
    if (debugMode) {
      console.error("Anthropic API execution failed:", error);
    }
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
  }
}

/**
 * Executes a Claude command and yields streaming responses
 * @param message - User message or command
 * @param requestId - Unique request identifier for abort functionality
 * @param requestAbortControllers - Shared map of abort controllers
 * @param claudePath - Path to claude executable (validated at startup)
 * @param sessionId - Optional session ID for conversation continuity
 * @param allowedTools - Optional array of allowed tool names
 * @param workingDirectory - Optional working directory for Claude execution
 * @param debugMode - Enable debug logging
 * @returns AsyncGenerator yielding StreamResponse objects
 */
async function* executeClaudeCommand(
  message: string,
  requestId: string,
  requestAbortControllers: Map<string, AbortController>,
  claudePath: string,
  sessionId?: string,
  allowedTools?: string[],
  workingDirectory?: string,
  claudeAuth?: ChatRequest['claudeAuth'],
  debugMode?: boolean,
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;

  try {
    // Pass message as-is (including slash commands like /cost, /help, etc.)
    const processedMessage = message;

    // Prepare authentication environment
    let authEnv: Record<string, string> = {};
    let executableArgs: string[] = [];
    
    try {
      if (debugMode) {
        console.log("[DEBUG] Starting authentication setup...");
      }
      
      // Write credentials file first (with OAuth credentials if provided)
      await writeClaudeCredentialsFile(claudeAuth);
      
      if (debugMode) {
        console.log("[DEBUG] Credentials file written, preparing auth environment...");
      }
      
      // Prepare auth environment
      const authEnvironment = await prepareClaudeAuthEnvironment();
      authEnv = authEnvironment.env;
      executableArgs = authEnvironment.executableArgs;
      
      // Disable preload script debug logging to prevent JSON parsing issues
      authEnv.DEBUG_PRELOAD_SCRIPT = "0";
      
      if (debugMode && Object.keys(authEnv).length > 0) {
        console.log("[DEBUG] Using Claude OAuth authentication");
        console.log("[DEBUG] Auth environment variables:", Object.keys(authEnv));
      }
    } catch (authError) {
      console.warn("[WARN] Failed to prepare Claude auth environment:", authError);
      if (debugMode) {
        console.debug("[DEBUG] Auth error details:", authError);
      }
      // Continue without auth - will fall back to system credentials
    }

    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    // Apply auth environment to process.env temporarily
    const originalEnv: Record<string, string | undefined> = {};
    
    // Set CLAUDE_CODE_OAUTH_TOKEN if available and clear API key env vars
    if (claudeAuth?.accessToken) {
      originalEnv.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      originalEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      originalEnv.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
      
      process.env.CLAUDE_CODE_OAUTH_TOKEN = claudeAuth.accessToken;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.CLAUDE_API_KEY;
      
      if (debugMode) {
        console.log("[DEBUG] Set CLAUDE_CODE_OAUTH_TOKEN and cleared API key env vars");
        console.log("[DEBUG] OAuth token length:", claudeAuth.accessToken.length);
      }
    }
    
    for (const [key, value] of Object.entries(authEnv)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }

    try {
      for await (const sdkMessage of query({
        prompt: processedMessage,
        options: {
          abortController,
          executable: "node" as const,
          executableArgs: executableArgs,
          pathToClaudeCodeExecutable: claudePath,
          ...(sessionId ? { resume: sessionId } : {}),
          ...(allowedTools ? { allowedTools } : {}),
          ...(workingDirectory ? { cwd: workingDirectory } : {}),
          permissionMode: "bypassPermissions" as const,
        },
      })) {
        // Debug logging of raw SDK messages
        if (debugMode) {
          console.debug("[DEBUG] Claude SDK Message:");
          console.debug(JSON.stringify(sdkMessage, null, 2));
          console.debug("---");
        }

        yield {
          type: "claude_json",
          data: sdkMessage,
        };
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
    // Check if error is due to abort
    if (error instanceof AbortError) {
      yield { type: "aborted" };
    } else {
      if (debugMode) {
        console.error("Claude Code execution failed:", error);
      }
      
      // Provide more specific error messages for authentication issues
      let errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("exit with code 1") || errorMessage.includes("authentication")) {
        errorMessage = `Claude Code authentication failed. Please ensure valid OAuth credentials are provided. Original error: ${errorMessage}`;
      }
      
      yield {
        type: "error",
        error: errorMessage,
      };
    }
  } finally {
    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
  }
}

/**
 * Handles POST /api/chat requests with streaming responses
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Shared map of abort controllers
 * @returns Response with streaming NDJSON
 */
export async function handleChatRequest(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const chatRequest: ChatRequest = await c.req.json();
  const { debugMode, claudePath } = c.var.config;

  if (debugMode) {
    console.debug(
      "[DEBUG] Received chat request:",
      JSON.stringify(chatRequest, null, 2),
    );
  }

  // Handle OAuth credentials if provided in the request (both local and forwarded from other agents)
  if (chatRequest.claudeAuth) {
    try {
      if (debugMode) {
        console.debug("[DEBUG] Using OAuth credentials from request");
        console.debug("[DEBUG] OAuth user:", chatRequest.claudeAuth.account?.email_address);
        console.debug("[DEBUG] OAuth expires:", new Date(chatRequest.claudeAuth.expiresAt));
      }
      
      // Write the OAuth credentials to the credentials file
      // This will be used by the preload script to authenticate Claude Code
      // This works for both local execution and when this agent receives forwarded OAuth credentials
      await writeClaudeCredentialsFile(chatRequest.claudeAuth);
      
      if (debugMode) {
        console.debug("[DEBUG] OAuth credentials written successfully for Claude Code execution");
      }
    } catch (error) {
      console.error("[ERROR] Failed to write OAuth credentials:", error);
      // Don't fail the request, fall back to system credentials
    }
  } else if (debugMode) {
    console.debug("[DEBUG] No OAuth credentials provided, using system credentials");
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send an immediate connection acknowledgment to prevent 504 timeout
        const ackResponse: StreamResponse = {
          type: "claude_json",
          data: {
            type: "system",
            subtype: "connection_ack",
            timestamp: Date.now(),
          }
        };
        const ackData = JSON.stringify(ackResponse) + "\n";
        controller.enqueue(new TextEncoder().encode(ackData));
        
        // Send a small flush marker to ensure the connection is established
        controller.enqueue(new TextEncoder().encode(" \n"));

        // Check if this should use orchestrator mode
        let executionMethod;
        
        if (shouldUseOrchestrator(chatRequest.message, chatRequest.availableAgents)) {
          // Check if message mentions only one specific agent
          const mentionMatches = chatRequest.message.match(/@(\w+(?:-\w+)*)/g);
          if (mentionMatches && mentionMatches.length === 1 && chatRequest.availableAgents) {
            const mentionedAgentId = mentionMatches[0].substring(1); // Remove @
            const workerAgents = chatRequest.availableAgents.filter(agent => !agent.isOrchestrator);
            const mentionedAgent = workerAgents.find(agent => agent.id === mentionedAgentId);
            
            if (mentionedAgent) {
              // Single agent mentioned - make HTTP request to agent's endpoint
              if (debugMode) {
                console.debug(`[DEBUG] Single agent ${mentionedAgentId} mentioned, making HTTP request to ${mentionedAgent.apiEndpoint}`);
              }
              
              executionMethod = executeAgentHttpRequest(
                mentionedAgent,
                chatRequest.message,
                chatRequest.requestId,
                requestAbortControllers,
                chatRequest.sessionId,
                chatRequest.claudeAuth,
                debugMode,
              );
            } else {
              // Multi-agent orchestration
              executionMethod = executeOrchestratorWorkflow(
                chatRequest.message,
                chatRequest.requestId,
                requestAbortControllers,
                chatRequest.sessionId,
                debugMode,
                chatRequest.availableAgents,
                chatRequest.claudeAuth,
              );
            }
          } else {
            // Multi-agent or no mentions - use orchestration
            executionMethod = executeOrchestratorWorkflow(
              chatRequest.message,
              chatRequest.requestId,
              requestAbortControllers,
              chatRequest.sessionId,
              debugMode,
              chatRequest.availableAgents,
              chatRequest.claudeAuth,
            );
          }
        } else {
          // Not orchestrator - use local Claude execution
          executionMethod = executeClaudeCommand(
            chatRequest.message,
            chatRequest.requestId,
            requestAbortControllers,
            claudePath,
            chatRequest.sessionId,
            chatRequest.allowedTools,
            chatRequest.workingDirectory,
            chatRequest.claudeAuth,
            debugMode,
          );
        }

        for await (const chunk of executionMethod) {
          const data = JSON.stringify(chunk) + "\n";
          controller.enqueue(new TextEncoder().encode(data));
          
          // Add periodic flush markers to prevent buffering
          if (Math.random() < 0.3) { // 30% chance to add flush
            controller.enqueue(new TextEncoder().encode(" \n"));
          }
        }
        controller.close();
      } catch (error) {
        const errorResponse: StreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no", // Disable Nginx proxy buffering
      "X-Proxy-Buffering": "no", // Disable other proxy buffering
      "Pragma": "no-cache", // HTTP/1.0 compatibility
      "Expires": "0", // Prevent caching
      "Access-Control-Allow-Origin": "*", // CORS for streaming
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Expose-Headers": "Content-Type, Cache-Control",
    },
  });
}
