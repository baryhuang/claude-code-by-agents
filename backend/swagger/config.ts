import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agentrooms API',
      version: '0.1.40',
      description: 'Multi-agent development workspace API for managing conversations with remote AI agents',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'Agentrooms',
        url: 'https://github.com/sugyan/claude-code-webui',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        StreamResponse: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['claude_json', 'error', 'done', 'aborted'],
              description: 'Type of streaming response',
            },
            data: {
              type: 'object',
              description: 'SDKMessage object for claude_json type',
            },
            error: {
              type: 'string',
              description: 'Error message if type is error',
            },
          },
          required: ['type'],
        },
        ChatRequest: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'User message or command to send to Claude',
              example: 'Help me write a function to validate email addresses',
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID for conversation continuity',
              example: 'session-123',
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier for abort functionality',
              example: 'req-456',
            },
            allowedTools: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Optional array of allowed tool names',
              example: ['Read', 'Write', 'Bash'],
            },
            workingDirectory: {
              type: 'string',
              description: 'Optional working directory for Claude execution',
              example: '/home/user/my-project',
            },
            availableAgents: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Agent',
              },
              description: 'Available agents for multi-agent scenarios',
            },
          },
          required: ['message', 'requestId'],
        },
        Agent: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique agent identifier',
              example: 'readymojo-api',
            },
            name: {
              type: 'string',
              description: 'Human-readable agent name',
              example: 'ReadyMojo API',
            },
            description: {
              type: 'string',
              description: 'Agent description and specialization',
              example: 'Backend API and server logic',
            },
            workingDirectory: {
              type: 'string',
              description: 'Agent working directory path',
              example: '/home/user/readymojo-api',
            },
            apiEndpoint: {
              type: 'string',
              description: 'Agent API endpoint URL',
              example: 'http://207.254.39.121:8080',
            },
            isOrchestrator: {
              type: 'boolean',
              description: 'Whether this agent is an orchestrator',
              example: false,
            },
          },
          required: ['id', 'name', 'description', 'workingDirectory', 'apiEndpoint'],
        },
        ProjectInfo: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute path to the project directory',
              example: '/home/user/my-project',
            },
            encodedName: {
              type: 'string',
              description: 'URL-encoded project name for API endpoints',
              example: 'my-project-abc123',
            },
          },
          required: ['path', 'encodedName'],
        },
        ProjectsResponse: {
          type: 'object',
          properties: {
            projects: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ProjectInfo',
              },
              description: 'List of available projects',
            },
          },
          required: ['projects'],
        },
        ConversationSummary: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Unique session identifier',
              example: 'session-123',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              description: 'ISO timestamp when conversation started',
              example: '2024-01-15T10:30:00Z',
            },
            lastTime: {
              type: 'string',
              format: 'date-time',
              description: 'ISO timestamp of last message',
              example: '2024-01-15T11:45:00Z',
            },
            messageCount: {
              type: 'integer',
              description: 'Total number of messages in conversation',
              example: 12,
            },
            lastMessagePreview: {
              type: 'string',
              description: 'Preview of the last message in conversation',
              example: 'The function looks good! Here are a few suggestions...',
            },
            agentId: {
              type: 'string',
              description: 'Agent that created this conversation',
              example: 'readymojo-api',
            },
          },
          required: ['sessionId', 'startTime', 'lastTime', 'messageCount', 'lastMessagePreview'],
        },
        HistoryListResponse: {
          type: 'object',
          properties: {
            conversations: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ConversationSummary',
              },
              description: 'List of conversation summaries',
            },
          },
          required: ['conversations'],
        },
        ConversationHistory: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Unique session identifier',
              example: 'session-123',
            },
            messages: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Array of timestamped messages in the conversation',
            },
            metadata: {
              type: 'object',
              properties: {
                startTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp when conversation started',
                },
                endTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO timestamp when conversation ended',
                },
                messageCount: {
                  type: 'integer',
                  description: 'Total number of messages',
                },
                agentId: {
                  type: 'string',
                  description: 'Agent that created this conversation',
                },
              },
              required: ['startTime', 'endTime', 'messageCount'],
            },
          },
          required: ['sessionId', 'messages', 'metadata'],
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z',
            },
            service: {
              type: 'string',
              example: 'claude-code-web-agent',
            },
            version: {
              type: 'string',
              example: '0.1.37',
            },
          },
          required: ['status', 'timestamp', 'service', 'version'],
        },
        AbortRequest: {
          type: 'object',
          properties: {
            requestId: {
              type: 'string',
              description: 'Request ID to abort',
              example: 'req-456',
            },
          },
          required: ['requestId'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Failed to process request',
            },
          },
          required: ['error'],
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'System health and status endpoints',
      },
      {
        name: 'Chat',
        description: 'Chat and conversation endpoints',
      },
      {
        name: 'Projects',
        description: 'Project management endpoints',
      },
      {
        name: 'History',
        description: 'Conversation history endpoints',
      },
      {
        name: 'Agent Management',
        description: 'Remote agent management endpoints',
      },
    ],
  },
  apis: ['./**/*.ts'], // paths to files containing OpenAPI definitions
};

export const specs = swaggerJsdoc(options);