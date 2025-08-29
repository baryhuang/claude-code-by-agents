/**
 * Runtime-agnostic Hono application
 *
 * This module creates the Hono application with all routes and middleware,
 * but doesn't include runtime-specific code like CLI parsing or server startup.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Runtime } from "./runtime/types.ts";
import {
  type ConfigContext,
  createConfigMiddleware,
} from "./middleware/config.ts";
import { handleProjectsRequest } from "./handlers/projects.ts";
import { handleHistoriesRequest } from "./handlers/histories.ts";
import { handleConversationRequest } from "./handlers/conversations.ts";
import { handleChatRequest } from "./handlers/chat.ts";
import { handleMultiAgentChatRequest } from "./handlers/multiAgentChat.ts";
import { handleAbortRequest } from "./handlers/abort.ts";
import { handleAgentProjectsRequest } from "./handlers/agentProjects.ts";
import { handleAgentHistoriesRequest } from "./handlers/agentHistories.ts";
import { handleAgentConversationRequest } from "./handlers/agentConversations.ts";
import { globalRegistry } from "./providers/registry.ts";
import { globalImageHandler } from "./utils/imageHandling.ts";
import { specs } from "./swagger/config.ts";

export interface AppConfig {
  debugMode: boolean;
  staticPath: string;
  claudePath: string; // Now required since validateClaudeCli always returns a path
  openaiApiKey?: string; // Optional OpenAI API key for multi-agent support
  anthropicApiKey?: string; // Optional Anthropic API key for orchestrator mode
}

export function createApp(
  runtime: Runtime,
  config: AppConfig,
): Hono<ConfigContext> {
  const app = new Hono<ConfigContext>();

  // Initialize multi-agent system
  initializeMultiAgentSystem(config);

  // Store AbortControllers for each request (shared with chat handler)
  const requestAbortControllers = new Map<string, AbortController>();

  // Enhanced CORS middleware for Lambda compatibility
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type", 
        "X-Amz-Date", 
        "Authorization", 
        "X-Api-Key", 
        "X-Amz-Security-Token",
        "X-Requested-With"
      ],
      maxAge: 600,
      credentials: false,
    }),
  );

  // Error handling middleware with CORS headers
  app.onError((error, c) => {
    console.error('App Error:', error);
    
    // Ensure CORS headers are present in error responses
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Requested-With');
    
    return c.json(
      { 
        error: 'Internal Server Error',
        message: config.debugMode ? error.message : 'An error occurred'
      }, 
      500
    );
  });

  // Configuration middleware - makes app settings available to all handlers
  app.use(
    "*",
    createConfigMiddleware({
      debugMode: config.debugMode,
      runtime,
      claudePath: config.claudePath,
    }),
  );

  // API routes
  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the current status and basic information about the Agentrooms service
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy and operational
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   */
  app.get("/api/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "claude-code-web-agent",
      version: "0.1.37"
    });
  });

  /**
   * @swagger
   * /api/projects:
   *   get:
   *     summary: List available local project directories
   *     description: Retrieves list of available project directories from Claude configuration that have conversation history
   *     tags: [Projects]
   *     responses:
   *       200:
   *         description: List of projects with history
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProjectsResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/projects", (c) => handleProjectsRequest(c));

  /**
   * @swagger
   * /api/projects/{encodedProjectName}/histories:
   *   get:
   *     summary: Get conversation summaries for a local project
   *     description: Retrieves list of conversation summaries for a specific local project
   *     tags: [History]
   *     parameters:
   *       - in: path
   *         name: encodedProjectName
   *         required: true
   *         schema:
   *           type: string
   *         description: URL-encoded project name
   *     responses:
   *       200:
   *         description: List of conversation summaries
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HistoryListResponse'
   *       404:
   *         description: Project not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/projects/:encodedProjectName/histories", (c) =>
    handleHistoriesRequest(c),
  );

  /**
   * @swagger
   * /api/projects/{encodedProjectName}/histories/{sessionId}:
   *   get:
   *     summary: Get full conversation details for a local project
   *     description: Retrieves complete conversation history including all messages for a specific session
   *     tags: [History]
   *     parameters:
   *       - in: path
   *         name: encodedProjectName
   *         required: true
   *         schema:
   *           type: string
   *         description: URL-encoded project name
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique session identifier
   *     responses:
   *       200:
   *         description: Complete conversation history
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ConversationHistory'
   *       404:
   *         description: Project or session not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/projects/:encodedProjectName/histories/:sessionId", (c) =>
    handleConversationRequest(c),
  );

  // Agent history endpoints
  /**
   * @swagger
   * /api/agent-projects:
   *   get:
   *     summary: Get remote agent's available projects
   *     description: Retrieves list of available project directories from a remote agent's Claude configuration
   *     tags: [Agent Management]
   *     responses:
   *       200:
   *         description: List of remote agent's projects
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProjectsResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/agent-projects", (c) => handleAgentProjectsRequest(c));
  
  /**
   * @swagger
   * /api/agent-histories/{encodedProjectName}:
   *   get:
   *     summary: Get conversation summaries for a remote agent's project
   *     description: Retrieves list of conversation summaries from a remote agent for a specific project
   *     tags: [Agent Management]
   *     parameters:
   *       - in: path
   *         name: encodedProjectName
   *         required: true
   *         schema:
   *           type: string
   *         description: URL-encoded project name
   *     responses:
   *       200:
   *         description: List of conversation summaries from remote agent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HistoryListResponse'
   *       404:
   *         description: Project not found on remote agent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/agent-histories/:encodedProjectName", (c) =>
    handleAgentHistoriesRequest(c),
  );
  
  /**
   * @swagger
   * /api/agent-conversations/{encodedProjectName}/{sessionId}:
   *   get:
   *     summary: Get full conversation details from a remote agent
   *     description: Retrieves complete conversation history from a remote agent including all messages for a specific session
   *     tags: [Agent Management]
   *     parameters:
   *       - in: path
   *         name: encodedProjectName
   *         required: true
   *         schema:
   *           type: string
   *         description: URL-encoded project name
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique session identifier
   *     responses:
   *       200:
   *         description: Complete conversation history from remote agent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ConversationHistory'
   *       404:
   *         description: Project or session not found on remote agent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.get("/api/agent-conversations/:encodedProjectName/:sessionId", (c) =>
    handleAgentConversationRequest(c),
  );

  /**
   * @swagger
   * /api/abort/{requestId}:
   *   post:
   *     summary: Abort ongoing chat request
   *     description: Cancels a running chat request using its unique request ID
   *     tags: [Chat]
   *     parameters:
   *       - in: path
   *         name: requestId
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique request identifier to abort
   *     responses:
   *       200:
   *         description: Request aborted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Request aborted"
   *       404:
   *         description: Request ID not found or already completed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/abort/:requestId", (c) =>
    handleAbortRequest(c, requestAbortControllers),
  );

  /**
   * @swagger
   * /api/chat:
   *   post:
   *     summary: Main chat endpoint for Claude Code SDK integration
   *     description: Sends a message to Claude Code SDK or routes to specific agents. Returns streaming NDJSON responses.
   *     tags: [Chat]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ChatRequest'
   *           examples:
   *             simple_chat:
   *               summary: Simple chat message
   *               value:
   *                 message: "Help me write a function to validate email addresses"
   *                 requestId: "req-123"
   *             with_session:
   *               summary: Chat with session continuity
   *               value:
   *                 message: "Can you also add error handling to that function?"
   *                 sessionId: "session-456"
   *                 requestId: "req-124"
   *             with_tools:
   *               summary: Chat with specific tools allowed
   *               value:
   *                 message: "Read the package.json file and tell me the dependencies"
   *                 requestId: "req-125"
   *                 allowedTools: ["Read", "Glob"]
   *                 workingDirectory: "/path/to/project"
   *     responses:
   *       200:
   *         description: Streaming NDJSON response from Claude Code SDK
   *         content:
   *           application/x-ndjson:
   *             schema:
   *               $ref: '#/components/schemas/StreamResponse'
   *       400:
   *         description: Invalid request format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/chat", (c) => handleChatRequest(c, requestAbortControllers));
  
  /**
   * @swagger
   * /api/multi-agent-chat:
   *   post:
   *     summary: Multi-agent chat endpoint
   *     description: Handles orchestrated conversations between multiple remote agents
   *     tags: [Chat]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ChatRequest'
   *           examples:
   *             orchestrator_request:
   *               summary: Multi-agent orchestration request
   *               value:
   *                 message: "Create a user authentication system with frontend and backend components"
   *                 requestId: "req-orchestrate-123"
   *                 workingDirectory: "/tmp/orchestrator"
   *                 availableAgents:
   *                   - id: "frontend-agent"
   *                     name: "Frontend Agent"
   *                     description: "Handles React/TypeScript frontend development"
   *                     workingDirectory: "/path/to/frontend"
   *                     apiEndpoint: "http://frontend-agent:8080"
   *                   - id: "backend-agent"
   *                     name: "Backend Agent" 
   *                     description: "Handles Node.js/Express backend development"
   *                     workingDirectory: "/path/to/backend"
   *                     apiEndpoint: "http://backend-agent:8080"
   *     responses:
   *       200:
   *         description: Streaming NDJSON response from orchestrated agents
   *         content:
   *           application/x-ndjson:
   *             schema:
   *               $ref: '#/components/schemas/StreamResponse'
   *       400:
   *         description: Invalid request format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post("/api/multi-agent-chat", (c) => handleMultiAgentChatRequest(c, requestAbortControllers));

  // Explicit preflight OPTIONS handler for all routes
  app.options("*", (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Requested-With');
    c.header('Access-Control-Max-Age', '600');
    return new Response('', { status: 204 });
  });

  // Swagger API documentation routes
  /**
   * @swagger
   * /api-docs:
   *   get:
   *     summary: Swagger API documentation UI
   *     description: Interactive API documentation interface
   *     tags: [Documentation]
   *     responses:
   *       200:
   *         description: Swagger UI HTML page
   *         content:
   *           text/html:
   *             schema:
   *               type: string
   */
  app.get("/api-docs", (c) => {
    const swaggerUiCss = `
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui.css" />
      <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
      </style>
    `;
    
    const swaggerUiJs = `
      <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: '/api-docs.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout"
          });
        };
      </script>
    `;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Agentrooms API Documentation</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          ${swaggerUiCss}
        </head>
        <body>
          <div id="swagger-ui"></div>
          ${swaggerUiJs}
        </body>
      </html>
    `;
    
    return c.html(html);
  });

  /**
   * @swagger
   * /api-docs.json:
   *   get:
   *     summary: OpenAPI specification in JSON format
   *     description: Raw OpenAPI 3.0 specification for the Agentrooms API
   *     tags: [Documentation]
   *     responses:
   *       200:
   *         description: OpenAPI specification
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  app.get("/api-docs.json", (c) => {
    return c.json(specs);
  });

  // Static file serving with SPA fallback
  // Serve static assets (CSS, JS, images, etc.)
  const serveStatic = runtime.createStaticFileMiddleware({
    root: config.staticPath,
  });
  app.use("/assets/*", serveStatic);

  // SPA fallback - serve index.html for all unmatched routes (except API routes)
  app.get("*", async (c) => {
    const path = c.req.path;

    // Skip API routes
    if (path.startsWith("/api/")) {
      return c.text("Not found", 404);
    }

    try {
      const indexPath = `${config.staticPath}/index.html`;
      const indexFile = await runtime.readBinaryFile(indexPath);
      return c.html(new TextDecoder().decode(indexFile));
    } catch (error) {
      console.error("Error serving index.html:", error);
      return c.text("Internal server error", 500);
    }
  });

  return app;
}

/**
 * Initialize the multi-agent system with providers and default agents
 */
function initializeMultiAgentSystem(config: AppConfig): void {
  // Initialize image handler
  globalImageHandler.initialize().catch(error => {
    console.warn("Failed to initialize image handler:", error);
  });
  
  // Initialize providers
  globalRegistry.initializeDefaultProviders({
    openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
    claudePath: config.claudePath,
    anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
  });
  
  // Create default agents
  globalRegistry.createDefaultAgents();
  
  if (config.debugMode) {
    console.debug("[Multi-Agent] Initialized with agents:", 
      globalRegistry.getAllAgents().map(a => ({ id: a.id, provider: a.provider }))
    );
  }
}
