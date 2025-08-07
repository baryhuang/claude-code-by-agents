# Agentrooms: Multi-Agent Development Workspace

**Two ways to use this project:**
1. **🖥️ Desktop UI**: Visual workspace for managing multiple Claude Code agents
2. **🔌 Direct API**: Programmatic access to remote Claude Code instances (not available in official SDK)

Multi-agent workspace for collaborative development with Claude CLI. Route tasks to specialized agents (local or remote), coordinate complex workflows.

> **Why this matters for developers**: The Claude Code SDK doesn't natively support remote agent control. This project fills that gap by providing REST APIs to control Claude Code instances running on remote machines, plus a UI for non-technical users.

> **Current Status**: This version supports one agent room. Multiple rooms support is planned for future releases - contributions welcome!

<img width="1304" height="811" alt="Screenshot 2025-07-25 at 10 00 57 AM" src="https://github.com/user-attachments/assets/99c6095c-8c1d-4a69-a240-2a974e01c097" />

> **Forked from [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui)**

https://github.com/user-attachments/assets/0b4e6709-d9b9-4676-85e0-aec8e15fd097


## Key Features

### 🖥️ UI Features (Desktop App)
- **`@agent-name` mentions**: Direct execution, no orchestration overhead
- **Multi-agent workflows**: Automatic task decomposition and coordination  
- **Local + Remote agents**: Mix local agents and remote machines (Mac Mini browser agent, cloud instances, etc.)
- **Dynamic agents**: Add/remove agents via web UI
- **Agent Hub**: Visual grid of all configured agents with status indicators
- **Conversation History**: Agent-specific conversation management and restoration

### 🔌 API Features (Developers)
- **Remote Claude Code Control**: REST APIs to control Claude Code instances on remote machines
- **Session Continuity**: Maintain conversation context across API calls
- **Multi-Project Support**: Switch between different codebases/working directories
- **Real-time Streaming**: Get live responses from Claude Code operations
- **Request Management**: Abort long-running operations programmatically
- **Swagger Documentation**: Interactive API docs at `/api-docs`

### ⚡ Shared Features
- **Free orchestrator Anthropic usage**: No API key required (uses my endpoint to cover your cost by default) Sure you can bring your own API_KEY
- **Custom API support**: Configure your own endpoint in Settings

## Choose Your Approach

### 🖥️ UI Approach (Non-Technical Users)
Perfect for users who prefer visual interfaces and want to coordinate multiple agents through a desktop application.

### 🔌 API Approach (Developers)
For developers who need programmatic control over remote Claude Code instances or want to integrate agent capabilities into their own applications.

**Why use the API directly?**
- **Custom integrations**: Build Claude Code into your own tools
- **CI/CD automation**: Integrate agents into your development pipeline  
- **Script automation**: Write scripts that coordinate multiple agents
- **Advanced workflows**: Create complex multi-step processes
- **Remote access**: Control Claude Code on servers, Mac Minis, etc.

## API Architecture

- **Planner**: Uses API key for task analysis and coordination
- **Agents**: Use your local Claude CLI subscription for execution
- **Default**: Free public endpoint (zero setup)
- **Custom**: Set your API URL in Settings for private deployment

## Quick Start

### Prerequisites
1. **Install Claude CLI**: Download from [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)
2. **Authenticate**: Run `claude auth login` and complete the authentication

## 🖥️ UI Setup (Desktop App)

### Option 1: Download Pre-built App (Recommended)

- Download from [Releases](https://github.com/baryhuang/claude-code-by-agents/releases)
- **Windows**: `claude-code-webui-windows-x64.exe` - Run the installer
- **macOS Intel**: `claude-code-webui-macos-x64` - Drag to Applications folder  
- **macOS Apple Silicon**: `claude-code-webui-macos-arm64` - Drag to Applications folder
- **Linux x64**: `claude-code-webui-linux-x64` - Make executable and run
- **Linux ARM64**: `claude-code-webui-linux-arm64` - Make executable and run
- **Important**: Start the backend service separately (see Backend Setup below)

### Option 2: Build from Source
```bash
# Clone and build
git clone https://github.com/baryhuang/claude-code-by-agents.git
cd claude-code-by-agents
npm install
npm run build:frontend
npm run dist:mac     # Creates macOS DMG in dist/ folder
npm run dist:win     # Creates Windows installer in dist/ folder  
npm run dist:linux   # Creates Linux AppImage in dist/ folder
```

## 🔌 API Setup (Developers)

### For Direct API Access
```bash
# Start backend service only
cd backend && deno task dev        # Backend: http://localhost:8080

# API is now available at http://localhost:8080/api/*
# Interactive docs at http://localhost:8080/api-docs
```

### For Web Development (API + UI)
```bash
# Start backend service
cd backend && deno task dev        # Backend: http://localhost:8080

# Start frontend (separate terminal)
cd frontend && npm run dev         # Frontend: http://localhost:3000
```

### Backend Setup (Required for Desktop Apps)

The desktop apps run frontend-only. Start the backend service separately:

```bash
# Clone the repository
git clone https://github.com/baryhuang/claude-code-by-agents.git
cd claude-code-by-agents

# Start backend service
cd backend && deno task dev
# Backend will run on http://localhost:8080
```

**Configure Frontend to Connect:**
- Open the Agentrooms app (Windows: run .exe installer, macOS: drag to Applications, Linux: make executable and run)
- Frontend will automatically connect to `localhost:8080`
- If backend is on different port, update frontend config

### Agent Setup (Optional)
```bash
# Start additional agent instances
cd path/to/agent1 && deno task dev --port 8081   # Local agent
cd path/to/agent2 && deno task dev --port 8082   # Local agent
# Remote agents: Run on other machines, expose ports

# Configure agents in Settings UI
```

## Usage Examples

### 🖥️ Using the Desktop UI

**Single agent**: `@api-agent add user authentication`
- Direct HTTP call to agent endpoint
- No coordination overhead

**Multi-agent**: `"Create full auth system with frontend and backend"`
- Orchestrator analyzes and creates execution plan
- Coordinates file-based communication between agents
- Manages dependencies automatically

### 🔌 Using the API Directly

**Start a conversation with Claude Code:**
```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a new Express.js API endpoint for user authentication",
    "workingDirectory": "/path/to/your/project",
    "requestId": "unique-request-id"
  }'
```

**Continue a conversation (with session continuity):**
```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Add password hashing to that endpoint",
    "sessionId": "session-from-previous-response",
    "workingDirectory": "/path/to/your/project",
    "requestId": "another-unique-id"
  }'
```

**Explore the interactive API documentation:**
Visit `http://localhost:8080/api-docs` in your browser for full API reference with examples.

## Configuration

### In Settings UI:

1. **API Configuration**:
   - Default: Uses free public endpoint 
   - Custom: Set your API endpoint URL

2. **Add Agents** (local or remote):
   - Name: `API Backend Agent`
   - Description: `Handles backend API development`
   - Working Directory: `/path/to/backend`
   - API Endpoint: `http://localhost:8081` (local) or `http://mac-mini.local:8081` (remote)

3. **Agent Routing**:
   - First agent = orchestrator
   - @mentions route to specific agents
   - General requests use orchestrator

## Architecture

### 🖥️ UI Architecture
```
Frontend → Main Backend (Orchestrator) → Local Agent 1 (localhost:8081)
                                      → Local Agent 2 (localhost:8082)  
                                      → Remote Agent 3 (mac-mini.local:8081)
                                      → Remote Agent N (cloud-instance:8081)
```

### 🔌 API Architecture
```
Your App → REST API → Claude Code SDK → Local Claude CLI
         → Streaming responses
         → Session continuity
         → Multi-project support
```

**Single Agent Flow**:
```
User/API → @agent-name → HTTP Request → Agent's Claude Instance → Response
```

**Multi-Agent Flow**:
```
User/API → General Request → Orchestrator Analysis → Execution Plan
                                                   ↓
Agent 1 ← Step 1 ← File Dependencies ← Coordination Logic
Agent 2 ← Step 2 ← Read Step 1 Output  
Agent N ← Step N ← Read Previous Results
```

## 🔌 API Reference

**Core Endpoints:**
- `POST /api/chat` - Main Claude Code interaction
- `GET /api/projects` - List available projects
- `POST /api/abort/:requestId` - Cancel operations
- `GET /api/agent-projects` - Remote agent projects
- `GET /api/agent-histories/:project` - Conversation history

**Interactive Documentation:**
- **Swagger UI**: `http://localhost:8080/api-docs`
- **OpenAPI Spec**: `http://localhost:8080/api-docs.json`

All endpoints support streaming responses and maintain session continuity for natural conversations with Claude Code.

## Development

### Desktop App Development
```bash
# Run in development mode
npm run electron:dev    # Opens app with dev server

# Build production apps
npm run build:frontend  # Build frontend first
npm run dist:mac       # Creates macOS DMG files in dist/
npm run dist:win       # Creates Windows installer in dist/
npm run dist:linux     # Creates Linux AppImage in dist/
```

### Web Development
```bash
# Backend (Terminal 1)
cd backend && deno task dev        # http://localhost:8080

# Frontend (Terminal 2) 
cd frontend && npm run dev         # http://localhost:3000
```

### Quality Checks
```bash
make check      # Format, lint, typecheck, test all components
make format     # Format code with prettier
make test       # Run frontend and backend tests
make lint       # Lint TypeScript code
```

### Building
```bash
make build-backend   # Build Deno binary
make build-frontend  # Build React frontend
npm run dist        # Build all platforms (macOS, Windows, Linux)
```

## Contributing

- **Lefthook**: Pre-commit hooks ensure quality
- **TypeScript**: Full type safety
- **HTTP APIs**: RESTful agent communication
- **Dynamic config**: All agents configurable via UI

## License

MIT License
