# Claude Code Agentrooms

Multi-agent workspace for collaborative development with Claude CLI. Route tasks to specialized agents (local or remote), coordinate complex workflows.

> **Current Status**: This version supports one agent room. Multiple rooms support is planned for future releases - contributions welcome!

<img width="1304" height="811" alt="Screenshot 2025-07-25 at 10 00 57 AM" src="https://github.com/user-attachments/assets/99c6095c-8c1d-4a69-a240-2a974e01c097" />

> **Forked from [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui)**

https://github.com/user-attachments/assets/0b4e6709-d9b9-4676-85e0-aec8e15fd097


## Key Features

- **`@agent-name` mentions**: Direct execution, no orchestration overhead
- **Multi-agent workflows**: Automatic task decomposition and coordination  
- **Local + Remote agents**: Mix local agents and remote machines (Mac Mini browser agent, cloud instances, etc.)
- **Free orchestrator Anthropic usage**: No API key required (uses my endpoint to cover your cost by default ) Sure you can bring your own API_KEY
- **Custom API support**: Configure your own endpoint in Settings
- **Dynamic agents**: Add/remove agents via web UI

## API Design

- **Planner**: Uses API key for task analysis and coordination
- **Agents**: Use your local Claude CLI subscription for execution
- **Default**: Free public endpoint (zero setup)
- **Custom**: Set your API URL in Settings for private deployment

## Quick Start

```bash
# Prerequisites: Claude CLI installed + authenticated

# Option 1: Desktop App
make install && make electron      # Electron desktop app

# Option 2: Web Development  
cd backend && deno task dev        # Backend: http://localhost:8080
cd frontend && npm run dev         # Frontend: http://localhost:3000

# 3. Start agent instances (local or remote)
cd path/to/agent1 && deno task dev --port 8081   # Local agent
cd path/to/agent2 && deno task dev --port 8082   # Local agent
# Remote agents: Run on other machines, expose ports

# 4. Configure agents in Settings
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

```bash
# Desktop app
make electron           # Run Electron app
make dist              # Build production app  
make dmg               # Build macOS installer

# Quality checks
make check      # Format, lint, typecheck, test
make format     # Format code
make test       # Run tests

# Building
make build-backend   # Create binary
make build-frontend  # Build frontend
```

## Contributing

- **Lefthook**: Pre-commit hooks ensure quality
- **TypeScript**: Full type safety
- **HTTP APIs**: RESTful agent communication
- **Dynamic config**: All agents configurable via UI

## License

MIT License
