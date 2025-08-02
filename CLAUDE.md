# Agentrooms

Agentrooms is a multi-agent workspace that provides a web-based interface for collaborative development with specialized agents.

## Code Quality

Use `make check` to run quality checks before commits. CI/CD runs the same checks automatically.

## Architecture

This project consists of three main components:

### Backend (Deno/Node.js)

- **Location**: `backend/`
- **Port**: 8080 (configurable via CLI argument or PORT environment variable)
- **Technology**: TypeScript + Hono framework with runtime abstraction supporting both Deno and Node.js
- **Purpose**: Executes `claude` commands and streams JSON responses to frontend

**Key Features**:

- **Runtime Abstraction**: Clean separation between business logic and platform-specific code
- **Modular Architecture**: CLI, application core, and runtime layers clearly separated
- Command line interface with `--port`, `--help`, `--version` options  
- Startup validation to check Claude CLI availability
- Executes `claude --output-format stream-json --verbose -p <message>`
- Streams raw Claude JSON responses without modification
- Sets working directory to project root for claude command execution
- Provides CORS headers for frontend communication
- Single binary distribution support
- Session continuity support using Claude Code SDK's resume functionality
- **Comprehensive Testing**: Mock runtime enables full unit testing without external dependencies

**API Endpoints**:

- `GET /api/projects` - Retrieves list of available project directories
  - Response: `{ projects: ProjectInfo[] }` - Array of project info objects with path and encodedName
- `POST /api/chat` - Accepts chat messages and returns streaming responses
  - Request body: `{ message: string, sessionId?: string, requestId: string, allowedTools?: string[], workingDirectory?: string }`
  - `requestId` is required for request tracking and abort functionality
  - Optional `sessionId` enables conversation continuity within the same chat session
  - Optional `allowedTools` array restricts which tools Claude can use
  - Optional `workingDirectory` specifies the project directory for Claude execution
- `POST /api/abort/:requestId` - Aborts an ongoing request by request ID
- `GET /api/projects/:encodedProjectName/histories` - Retrieves list of conversation histories for a project
  - Response: `{ conversations: ConversationSummary[] }` - Array of conversation summaries with session metadata
- `GET /api/projects/:encodedProjectName/histories/:sessionId` - Retrieves detailed conversation history for a specific session
  - Response: `ConversationHistory` - Complete conversation with messages and metadata
- `/*` - Serves static frontend files (in single binary mode)

### Frontend (React)

- **Location**: `frontend/`
- **Port**: 3000 (configurable via `--port` CLI argument to `npm run dev`)
- **Technology**: Vite + React + SWC + TypeScript + TailwindCSS + React Router
- **Purpose**: Provides project selection and chat interface with streaming responses

**Key Features**:

- **Project Directory Selection**: Choose working directory before starting chat sessions
- **Routing System**: Separate pages for project selection, chat interface, and demo mode
- **Conversation History**: Browse and restore previous chat sessions with full message history
- **Demo Mode**: Interactive demonstration system with automated scenarios and mock responses
- Real-time streaming response display with modular message processing
- Parses different Claude JSON message types (system, assistant, result, tool messages)
- TailwindCSS utility-first styling for responsive design
- Light/dark theme toggle with system preference detection and localStorage persistence
- Bottom-to-top message flow layout (messages start at bottom like modern chat apps)
- Auto-scroll to bottom with smart scroll detection (only auto-scrolls when user is near bottom)
- Accessibility features with ARIA attributes for screen readers
- Responsive chat interface with component-based architecture
- Comprehensive component testing with Vitest and Testing Library
- Automatic session tracking for conversation continuity within the same chat instance
- Request abort functionality with real-time cancellation
- Permission dialog handling for Claude tool permissions
- Enhanced error handling and user feedback
- Modular hook architecture for state management and business logic separation
- Reusable UI components with consistent design patterns
- **History Management**: View conversation summaries, timestamps, and message previews
- **Demo Automation**: Automated demo recording and playback for presentations
- **Enter Key Behavior**: Configurable Enter key behavior (Send vs Newline) with persistent user preference

### Shared Types

- **Location**: `shared/`
- **Purpose**: TypeScript type definitions shared between backend and frontend

**Key Types**:

- `StreamResponse` - Backend streaming response format with support for claude_json, error, done, and aborted types
- `ChatRequest` - Chat request structure for API communication
  - `message: string` - User's message content
  - `sessionId?: string` - Optional session ID for conversation continuity
  - `requestId: string` - Required unique identifier for request tracking and abort functionality
  - `allowedTools?: string[]` - Optional array to restrict which tools Claude can use
  - `workingDirectory?: string` - Optional project directory path for Claude execution
- `AbortRequest` - Request structure for aborting ongoing operations
  - `requestId: string` - ID of the request to abort
- `ProjectInfo` - Project information structure
  - `path: string` - Full file system path to the project directory
  - `encodedName: string` - URL-safe encoded project name
- `ProjectsResponse` - Response structure for project directory list
  - `projects: ProjectInfo[]` - Array of project information objects
- `ConversationSummary` - Summary information for conversation history
  - `sessionId: string` - Unique session identifier
  - `startTime: string` - ISO timestamp of first message
  - `lastTime: string` - ISO timestamp of last message
  - `messageCount: number` - Total number of messages in conversation
  - `lastMessagePreview: string` - Preview text of the last message
- `HistoryListResponse` - Response structure for conversation history list
  - `conversations: ConversationSummary[]` - Array of conversation summaries
- `ConversationHistory` - Complete conversation history structure
  - `sessionId: string` - Session identifier
  - `messages: unknown[]` - Array of timestamped SDK messages (typed as unknown[] to avoid frontend dependency)
  - `metadata: object` - Conversation metadata with startTime, endTime, and messageCount

**Note**: Enhanced message types (`ChatMessage`, `SystemMessage`, `ToolMessage`, `ToolResultMessage`, etc.) are defined in `frontend/src/types.ts` for comprehensive frontend message handling.

## Claude Command Integration

The backend uses the Claude Code SDK to execute claude commands. The SDK internally handles the claude command execution with appropriate parameters including:

- `--output-format stream-json` - Returns streaming JSON responses
- `--verbose` - Includes detailed execution information
- `-p <message>` - Prompt mode with user message

The SDK returns three types of JSON messages:

1. **System messages** (`type: "system"`) - Initialization and setup information
2. **Assistant messages** (`type: "assistant"`) - Actual response content
3. **Result messages** (`type: "result"`) - Execution summary with costs and usage

## Session Continuity

The application supports conversation continuity within the same chat session using Claude Code SDK's built-in session management.

### How It Works

1. **Initial Message**: First message in a chat session starts a new Claude session
2. **Session Tracking**: Frontend automatically extracts `session_id` from incoming SDK messages
3. **Continuation**: Subsequent messages include the `session_id` to maintain conversation context
4. **Backend Integration**: Backend passes `session_id` to Claude Code SDK via `options.resume` parameter

### Technical Implementation

- **Frontend**: Tracks `currentSessionId` state and includes it in API requests
- **Backend**: Accepts optional `sessionId` in `ChatRequest` and uses it with SDK's `resume` option
- **Streaming**: Session IDs are extracted from all SDK message types (`system`, `assistant`, `result`)
- **Automatic**: No user intervention required - session continuity is handled transparently

### Benefits

- **Context Preservation**: Maintains conversation context across multiple messages
- **Improved UX**: Users can reference previous messages and build on earlier discussions
- **Efficient**: Leverages Claude Code SDK's native session management
- **Seamless**: Works automatically without user configuration

## Development

### Prerequisites

- **Backend**: Either Deno or Node.js (20.0.0+)
- **Frontend**: Node.js (for development)
- Claude CLI tool installed and configured
- dotenvx (for .env file processing): `npm install -g @dotenvx/dotenvx`

### Port Configuration

The application supports flexible port configuration for development:

#### Unified Backend Port Management

Create a `.env` file in the project root to set the backend port:

```bash
# .env
PORT=9000
```

Both backend startup and frontend proxy configuration will automatically use this port:

```bash
# Deno backend
cd backend && deno task dev     # Uses dotenvx to read ../.env and starts backend on port 9000

# Node.js backend  
cd backend && npm run dev       # Uses dotenvx to read ../.env and starts backend on port 9000

# Frontend
cd frontend && npm run dev      # Configures proxy to localhost:9000
```

#### Alternative Configuration Methods

- **Environment Variable**: `PORT=9000 deno task dev` or `PORT=9000 npm run dev`
- **CLI Argument (Deno)**: `dotenvx run --env-file=../.env -- deno run --allow-net --allow-run --allow-read --allow-env cli/deno.ts --port 9000`
- **CLI Argument (Node.js)**: `node dist/cli/node.js --port 9000`
- **Frontend Port**: `npm run dev -- --port 4000` (for frontend UI port)

### Running the Application

1. **Start Backend**:

   ```bash
   # Deno
   cd backend
   deno task dev
   
   # Or Node.js
   cd backend
   npm run dev
   ```

2. **Start Frontend**:

   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application**:
   - Frontend: http://localhost:3000 (or custom port via `npm run dev -- --port XXXX`)
   - Backend API: http://localhost:8080 (or PORT from .env file)

### Project Structure

```
├── backend/           # Backend server with runtime abstraction (Deno/Node.js)
│   ├── deno.json     # Deno configuration with permissions
│   ├── package.json  # Node.js configuration and dependencies
│   ├── app.ts        # Runtime-agnostic core application
│   ├── types.ts      # Backend-specific type definitions
│   ├── VERSION       # Version file for releases
│   ├── cli/          # CLI-specific entry points
│   │   ├── deno.ts           # Deno entry point and server startup
│   │   ├── node.ts           # Node.js entry point and server startup
│   │   ├── args.ts           # CLI argument parsing with runtime abstraction
│   │   ├── validation.ts     # Shared CLI validation utilities
│   │   └── version.ts        # Version reporting utility
│   ├── runtime/      # Runtime abstraction layer
│   │   ├── types.ts          # Runtime interface definitions
│   │   ├── deno.ts           # Deno runtime implementation
│   │   └── node.ts           # Node.js runtime implementation
│   ├── handlers/     # API handlers using runtime abstraction
│   │   ├── abort.ts         # Request abortion handler
│   │   ├── chat.ts          # Chat streaming handler
│   │   ├── conversations.ts # Conversation details handler
│   │   ├── histories.ts     # History listing handler
│   │   └── projects.ts      # Project listing handler
│   ├── history/      # History processing utilities
│   │   ├── conversationLoader.ts  # Load specific conversations
│   │   ├── grouping.ts             # Group conversation files
│   │   ├── parser.ts               # Parse history files
│   │   ├── pathUtils.ts            # Path validation utilities
│   │   └── timestampRestore.ts     # Restore message timestamps
│   ├── middleware/   # Middleware modules
│   │   └── config.ts        # Configuration middleware with runtime injection
│   ├── scripts/      # Build and packaging scripts
│   │   ├── build-bundle.js      # Bundle creation for distribution
│   │   ├── copy-frontend.js     # Frontend static file copying
│   │   ├── generate-version.js  # Version file generation
│   │   └── prepack.js           # NPM package preparation
│   ├── tests/        # Test files
│   │   └── node/            # Node.js-specific tests
│   ├── pathUtils.test.ts    # Path utility tests with mock runtime
│   └── dist/         # Frontend build output (copied during build)
├── frontend/         # React frontend application
│   ├── src/
│   │   ├── App.tsx   # Main application component with routing
│   │   ├── main.tsx  # Application entry point
│   │   ├── types.ts  # Frontend-specific type definitions
│   │   ├── config/
│   │   │   └── api.ts                 # API configuration and URLs
│   │   ├── utils/
│   │   │   ├── constants.ts           # UI and application constants
│   │   │   ├── messageTypes.ts        # Type guard functions for messages
│   │   │   ├── toolUtils.ts           # Tool-related utility functions
│   │   │   ├── time.ts                # Time utilities
│   │   │   ├── id.ts                  # ID generation utilities
│   │   │   ├── messageConversion.ts   # Message conversion utilities
│   │   │   └── mockResponseGenerator.ts # Demo response generator
│   │   ├── hooks/
│   │   │   ├── useClaudeStreaming.ts  # Simplified streaming interface
│   │   │   ├── useTheme.ts            # Theme management hook
│   │   │   ├── useHistoryLoader.ts    # History loading hook
│   │   │   ├── useMessageConverter.ts # Message conversion hook
│   │   │   ├── useDemoAutomation.ts   # Demo automation hook
│   │   │   ├── useEnterBehavior.ts    # Enter key behavior management
│   │   │   ├── chat/
│   │   │   │   ├── useChatState.ts    # Chat state management
│   │   │   │   ├── usePermissions.ts  # Permission handling logic
│   │   │   │   └── useAbortController.ts # Request abortion logic
│   │   │   └── streaming/
│   │   │       ├── useMessageProcessor.ts # Message creation and processing
│   │   │       ├── useToolHandling.ts     # Tool-specific message handling
│   │   │       └── useStreamParser.ts     # Stream parsing and routing
│   │   ├── components/
│   │   │   ├── ChatPage.tsx           # Main chat interface page
│   │   │   ├── ProjectSelector.tsx    # Project directory selection page
│   │   │   ├── MessageComponents.tsx  # Message display components
│   │   │   ├── PermissionDialog.tsx   # Permission handling dialog
│   │   │   ├── TimestampComponent.tsx # Timestamp display
│   │   │   ├── HistoryView.tsx        # Conversation history view
│   │   │   ├── DemoPage.tsx           # Demo mode page
│   │   │   ├── DemoPermissionDialogWrapper.tsx # Demo permission wrapper
│   │   │   ├── chat/
│   │   │   │   ├── ThemeToggle.tsx          # Theme toggle button
│   │   │   │   ├── ChatInput.tsx            # Chat input component
│   │   │   │   ├── ChatMessages.tsx         # Chat messages container
│   │   │   │   ├── HistoryButton.tsx        # History access button
│   │   │   │   ├── EnterBehaviorToggle.tsx  # Enter behavior toggle button
│   │   │   │   └── EnterModeMenu.tsx        # Enter mode selection menu
│   │   │   └── messages/
│   │   │       ├── MessageContainer.tsx   # Reusable message wrapper
│   │   │       └── CollapsibleDetails.tsx # Collapsible content component
│   │   ├── types/
│   │   │   ├── window.d.ts      # Window type extensions
│   │   │   └── enterBehavior.ts # Enter behavior type definitions
│   │   ├── contexts/           # React contexts
│   │   │   ├── EnterBehaviorContext.tsx        # Enter behavior context provider
│   │   │   └── EnterBehaviorContextDefinition.ts # Context definition
│   │   ├── scripts/            # Demo recording scripts
│   │   │   ├── record-demo.ts         # Demo recorder
│   │   │   ├── demo-constants.ts      # Demo configuration
│   │   │   └── compare-demo-videos.ts # Demo comparison
│   │   ├── tests/              # End-to-end tests
│   │   │   └── demo-validation.spec.ts # Demo validation tests
│   │   ├── package.json
│   │   └── vite.config.ts     # Vite config with @tailwindcss/vite plugin
├── shared/           # Shared TypeScript types
│   └── types.ts
├── CLAUDE.md        # Technical documentation
└── README.md        # User documentation
```

## Key Design Decisions

1. **Runtime Abstraction Architecture**: Complete separation between business logic and platform-specific code using a minimal Runtime interface. All handlers, utilities, and CLI components use runtime abstraction instead of direct Deno APIs, enabling comprehensive testing with mock runtime and future platform flexibility.

2. **Modular Entry Points**: CLI-specific code separated into `cli/` directory with `deno.ts` and `node.ts` as runtime-specific entry points, while `app.ts` contains the runtime-agnostic core application. This enables clean separation of concerns and cross-platform compatibility.

3. **Raw JSON Streaming**: Backend passes Claude JSON responses without modification to allow frontend flexibility in handling different message types.

4. **Configurable Ports**: Backend port configurable via PORT environment variable or CLI argument, frontend port via CLI argument to allow independent development and deployment.

5. **TypeScript Throughout**: Consistent TypeScript usage across all components with shared type definitions.

6. **TailwindCSS Styling**: Uses @tailwindcss/vite plugin for utility-first CSS without separate CSS files.

7. **Theme System**: Light/dark theme toggle with automatic system preference detection and localStorage persistence.

8. **Project Directory Selection**: Users choose working directory before starting chat sessions, with support for both configured projects and custom directory selection.

9. **Routing Architecture**: React Router separates project selection and chat interfaces for better user experience.

10. **Dynamic Working Directory**: Claude commands execute in user-selected project directories for contextual file access.

11. **Request Management**: Unique request IDs enable request tracking and abort functionality for better user control.

12. **Tool Permission Handling**: Frontend permission dialog allows users to grant/deny tool access with proper state management.

13. **Comprehensive Error Handling**: Enhanced error states and user feedback for better debugging and user experience.

14. **Modular Architecture**: Frontend code is organized into specialized hooks and components for better maintainability and testability.

15. **Separation of Concerns**: Business logic, UI components, and utilities are clearly separated into different modules.

16. **Configuration Management**: Centralized configuration for API endpoints and application constants.

17. **Reusable Components**: Common UI patterns are extracted into reusable components to reduce duplication.

18. **Hook Composition**: Complex functionality is built by composing smaller, focused hooks that each handle a specific concern.

19. **Enter Key Behavior**: Configurable Enter key behavior with persistent user preferences, supporting both traditional (Enter=Send) and modern (Enter=Newline) interaction patterns.

## Claude Code SDK Types Reference

**SDK Types**: `frontend/node_modules/@anthropic-ai/claude-code/sdk.d.ts`

### Common Patterns
```typescript
// Type extraction
const systemMsg = sdkMessage as Extract<SDKMessage, { type: "system" }>;
const assistantMsg = sdkMessage as Extract<SDKMessage, { type: "assistant" }>;
const resultMsg = sdkMessage as Extract<SDKMessage, { type: "result" }>;

// Assistant content access (nested structure!)
for (const item of assistantMsg.message.content) {
  if (item.type === "text") {
    const text = (item as { text: string }).text;
  } else if (item.type === "tool_use") {
    const toolUse = item as { name: string; input: Record<string, unknown> };
  }
}

// System message (no .message property)
console.log(systemMsg.cwd); // Direct access, no nesting
```

### Key Points
- **System**: Fields directly on object (`systemMsg.cwd`, `systemMsg.tools`)
- **Assistant**: Content nested under `message.content` 
- **Result**: Has `subtype` field (`success` | `error_max_turns` | `error_during_execution`)
- **Type Safety**: Always use `Extract<SDKMessage, { type: "..." }>` for narrowing

## Frontend Architecture Benefits

The modular frontend architecture provides several key benefits:

### Code Organization
- **Reduced File Size**: Main App.tsx reduced from 467 to 262 lines (44% reduction)
- **Focused Responsibilities**: Each file has a single, clear purpose
- **Logical Grouping**: Related functionality is organized into coherent modules

### Maintainability
- **Easier Debugging**: Issues can be isolated to specific modules
- **Simplified Testing**: Individual components and hooks can be tested in isolation
- **Clear Dependencies**: Import structure clearly shows component relationships

### Reusability
- **Shared Components**: `MessageContainer` and `CollapsibleDetails` reduce UI duplication
- **Utility Functions**: Common operations are centralized and reusable
- **Configuration**: API endpoints and constants are easily configurable

### Developer Experience
- **Type Safety**: Enhanced TypeScript coverage with stricter type definitions
- **IntelliSense**: Better IDE support with smaller, focused modules
- **Hot Reload**: Faster development cycles with smaller change surfaces

### Performance
- **Bundle Optimization**: Tree-shaking is more effective with modular code
- **Code Splitting**: Easier to implement lazy loading for large features
- **Memory Efficiency**: Reduced memory footprint with focused hooks

## Testing

The project includes comprehensive test suites for both frontend and backend components:

### Frontend Testing

- **Framework**: Vitest with Testing Library
- **Coverage**: Component testing, hook testing, and integration tests
- **Location**: Tests are co-located with source files (`*.test.ts`, `*.test.tsx`)
- **Run**: `make test-frontend` or `cd frontend && npm run test:run`

### Backend Testing  

- **Framework**: Deno's built-in test runner with std/assert
- **Coverage**: Path encoding utilities, API handlers, and integration tests
- **Location**: `backend/pathUtils.test.ts` and other `*.test.ts` files
- **Run**: `make test-backend` or `cd backend && deno task test`

### Unified Testing

- **All Tests**: `make test` - Runs both frontend and backend tests
- **Quality Checks**: `make check` - Includes tests in pre-commit quality validation
- **CI Integration**: GitHub Actions automatically runs all tests on push/PR

## Single Binary Distribution

The project supports creating self-contained executables for all major platforms:

### Local Building

```bash
# Build for current platform
cd backend && deno task build

# Cross-platform builds are handled by GitHub Actions
```

### Automated Releases

- **Trigger**: Push git tags (e.g., `git tag v1.0.0 && git push origin v1.0.0`)
- **Platforms**: Linux (x64/ARM64), macOS (x64/ARM64)
- **Output**: GitHub Releases with downloadable binaries
- **Features**: Frontend is automatically bundled into each binary

## Claude Code Dependency Management

### Current Version Policy

Both frontend and backend use **fixed versions** (without caret `^`) to ensure consistency:

- **Frontend**: `frontend/package.json` - `"@anthropic-ai/claude-code": "1.0.51"`
- **Backend**: 
  - Deno: `backend/deno.json` imports - `"@anthropic-ai/claude-code": "npm:@anthropic-ai/claude-code@1.0.51"`
  - Node.js: `backend/package.json` - `"@anthropic-ai/claude-code": "1.0.51"`

### Version Update Procedure

When updating to a new Claude Code version (e.g., 1.0.40):

1. **Check current versions**:
   ```bash
   # Frontend
   grep "@anthropic-ai/claude-code" frontend/package.json
   
   # Backend  
   grep "@anthropic-ai/claude-code" backend/deno.json
   ```

2. **Update Frontend**:
   ```bash
   # Edit frontend/package.json - change version number
   # "@anthropic-ai/claude-code": "1.0.XX"
   cd frontend && npm install
   ```

3. **Update Backend**:
   ```bash
   # For Deno: Edit backend/deno.json imports - change version number
   # "@anthropic-ai/claude-code": "npm:@anthropic-ai/claude-code@1.0.XX"
   cd backend && rm deno.lock && deno cache main.ts
   
   # For Node.js: Edit backend/package.json - change version number  
   # "@anthropic-ai/claude-code": "1.0.XX"
   cd backend && npm install
   ```

4. **Verify and test**:
   ```bash
   make check
   ```

### Version Consistency Check

Ensure all environments use the same version:
```bash
# Should show the same version number across all package configs
grep "@anthropic-ai/claude-code" frontend/package.json backend/deno.json backend/package.json
```

## Commands for Claude

### Unified Commands (from project root)

- **Format**: `make format` - Format both frontend and backend
- **Lint**: `make lint` - Lint both frontend and backend
- **Type Check**: `make typecheck` - Type check both frontend and backend
- **Test**: `make test` - Run both frontend and backend tests
- **Quality Check**: `make check` - Run all quality checks before commit
- **Format Specific Files**: `make format-files FILES="file1 file2"` - Format specific files with prettier

### Individual Commands

- **Development**: `make dev-backend` / `make dev-frontend`
- **Testing**: `make test-frontend` / `make test-backend`
- **Build Binary**: `make build-backend`
- **Build Frontend**: `make build-frontend`

**Note**: Lefthook automatically runs `make check` before every commit. GitHub Actions will also run all quality checks on push and pull requests.

## Development Workflow

### Pull Request Process

Create feature branch, make changes, push, and create PR with appropriate labels. CHANGELOG.md is auto-managed.

### Release Process

Releases are automated via tagpr. Use version labels (`minor`, `major`) on PRs if needed, otherwise defaults to patch version.

**Important for Claude**: Always run commands from the project root directory. When using `cd` commands for backend/frontend, use full paths like `cd /path/to/project/backend` to avoid getting lost in subdirectories.

## Project-Specific Technical Context

### Multi-Agent Architecture

**Key Constraint**: Main chat room uses application state persistence (NOT Claude Code history). Individual agent sessions use Claude Code SDK for continuity.

**Remote History Implementation**: 
- History only appears in AgentDetailView, never main chat
- Remote agents expose `~/.claude/projects/` via `/api/agent-projects`, `/api/agent-histories/:project`, `/api/agent-conversations/:project/:session`
- Agent-specific filtering: projects filtered by agent's working directory + description keywords
- 5-minute caching to prevent API spam

### Critical State Management

**useAgentConfig Hook**: Must return `agents: config.agents` for legacy component compatibility

**Loading State Bug Prevention**: Always use `hasAttemptedHistoryLoad` flags and `finally` blocks to prevent infinite loading loops

**Agent Isolation**: Each agent maintains separate `agentSessions[agentId].messages` and `sessionId` to prevent cross-contamination

### Electron Production Issues

**Frontend Loading**: Packaged apps must use `path.join(__dirname, '../frontend/dist/index.html')` not `process.resourcesPath` paths

**Build Requirement**: Must run `vite build` (not `tsc + vite build`) before `electron-builder` to avoid TypeScript blocking errors

### UX Requirements

**History Panel**: "Current Chat" vs "History" tabs in AgentDetailView. After loading conversation, auto-switch back to "Current Chat" tab.

**Error Messages**: Use specific messages like "Could not find the project for this conversation" not generic "failed to load"
