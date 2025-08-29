# Claude Code Agentrooms UI + Remote Claude Code API

Multi-agent workspace for collaborative development with Claude CLI. Route tasks to specialized agents (local or remote), coordinate complex workflows.

> **Current Status**: This version supports one agent room. Multiple rooms support is planned for future releases - contributions welcome!

<img width="1304" height="811" alt="Screenshot 2025-07-25 at 10 00 57 AM" src="https://github.com/user-attachments/assets/99c6095c-8c1d-4a69-a240-2a974e01c097" />

> **Forked from [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui)**

https://github.com/user-attachments/assets/0b4e6709-d9b9-4676-85e0-aec8e15fd097


## Key Features

- **`@agent-name` mentions**: Direct execution, no orchestration overhead
- **Multi-agent workflows**: Automatic task decomposition and coordination  
- **Local + Remote agents**: Mix local agents and remote machines (Mac Mini browser agent, cloud instances, etc.)
- **No API key required**: Uses your Claude subscription via Claude CLI authentication  
- **Multi-agent orchestration**: Intelligent task coordination between specialized agents
- **Custom API support**: Configure your own endpoint in Settings for private deployment
- **Dynamic agents**: Add/remove agents via web UI

## Authentication & Billing

**✅ No API Keys Required** 
- Uses your existing Claude subscription through Claude CLI authentication
- Orchestrator and all agents run through your authenticated Claude session
- Same billing model as using Claude Code directly

**How it works:**
1. **Claude CLI auth**: `claude auth login` authenticates your session
2. **Subscription usage**: All requests count against your Claude subscription (Pro, Team, etc.)
3. **No additional costs**: Same as running `claude` commands locally
4. **OAuth integration**: Seamless authentication through Claude's official auth system

## Quick Start

### Prerequisites
1. **Claude Subscription**: Requires Claude Pro, Team, or Enterprise subscription
2. **Install Claude CLI**: Download from [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)
3. **Authenticate**: Run `claude auth login` and complete OAuth authentication
   - This connects Agentrooms to your Claude subscription
   - No API keys needed - uses OAuth tokens securely

### Option 1: Desktop App (Recommended)

**Download Pre-built App:**
- Download from [Releases](https://github.com/baryhuang/claude-code-by-agents/releases)
- **Windows**: `claude-code-webui-windows-x64.exe` - Run the installer
- **macOS Intel**: `claude-code-webui-macos-x64` - Drag to Applications folder  
- **macOS Apple Silicon**: `claude-code-webui-macos-arm64` - Drag to Applications folder
- **Linux x64**: `claude-code-webui-linux-x64` - Make executable and run
- **Linux ARM64**: `claude-code-webui-linux-arm64` - Make executable and run
- **Important**: Start the backend service separately (see Backend Setup below)

**Build from Source:**
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

### Option 2: Web Development
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

## Usage

**Single agent**: `@api-agent add user authentication`
- Direct HTTP call to agent endpoint
- No coordination overhead

**Multi-agent**: `"Create full auth system with frontend and backend"`
- Orchestrator analyzes and creates execution plan
- Coordinates file-based communication between agents
- Manages dependencies automatically

## Configuration

### In Settings UI:

1. **Authentication** (Handled automatically):
   - Uses your Claude CLI authentication (`claude auth login`)
   - OAuth tokens managed securely by Claude CLI
   - All requests billed to your Claude subscription

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

```
Frontend → Main Backend (Orchestrator) → Local Agent 1 (localhost:8081)
                                      → Local Agent 2 (localhost:8082)  
                                      → Remote Agent 3 (mac-mini.local:8081)
                                      → Remote Agent N (cloud-instance:8081)
```

**Single Agent Flow**:
```
User → @agent-name → HTTP Request → Agent's Claude Instance → Response
```

**Multi-Agent Flow**:
```
User → General Request → Orchestrator Analysis → Execution Plan
                                                ↓
Agent 1 ← Step 1 ← File Dependencies ← Coordination Logic
Agent 2 ← Step 2 ← Read Step 1 Output  
Agent N ← Step N ← Read Previous Results
```

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
