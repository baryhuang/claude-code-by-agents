# Agentrooms - Multi-Agent Development Workspace

## Product Vision

**Problem**: Developers need to coordinate multiple AI agents working on different parts of a project, each with specialized skills and access to different codebases.

**Solution**: Electron desktop app that provides a unified workspace for managing conversations with multiple remote AI agents, each running Claude Code on their own machines.

## UX Page Journey

### 1. Agent Hub Page (Main Entry)
- **Grid Layout**: All configured agents displayed as cards with status indicators
- **Agent Cards**: Show name, specialization, working directory, connection status
- **Primary Action**: Click agent card → navigate to Agent Detail View
- **Secondary Actions**: Add new agent, configure existing agents

### 2. Agent Detail View (Core Interaction)
- **Tab Interface**: [Current Chat] [History] - never both visible simultaneously
- **Current Chat Tab**: 
  - Real-time conversation with selected agent
  - Uses Claude Code SDK session continuity
  - Messages attributed to specific agentId
- **History Tab**:
  - Agent-specific conversation list (filtered by working directory)
  - Click conversation → loads into Current Chat tab + auto-switch back
  - Shows conversations from agent's remote conversation history

### 3. Orchestrator Chat (Separate Context)
- **Purpose**: Multi-agent planning and coordination
- **Storage**: Local app state (NOT Claude Code history)
- **Access**: Available from Agent Hub or as separate mode
- **Isolation**: Completely separate from individual agent conversations

## User Journeys

### Journey 1: New User Setup
1. **Launch App** → Agent Hub Page (empty state)
2. **Click "Add Agent"** → Agent configuration form
3. **Fill agent details**: name, API endpoint, working directory, specialization
4. **Save agent** → Returns to Agent Hub with new agent card
5. **Repeat** for additional agents
6. **Result**: Grid of configured agents ready for interaction

### Journey 2: Single Agent Conversation
1. **Agent Hub Page** → Click specific agent card
2. **Agent Detail View** opens on "Current Chat" tab
3. **Type message** → Send to agent
4. **Real-time streaming response** appears
5. **Continue conversation** → Each message maintains session continuity
6. **Navigate back** → Return to Agent Hub (conversation state preserved)

### Journey 3: Viewing Agent History
1. **Agent Hub Page** → Click agent card → Agent Detail View
2. **Click "History" tab** → Loads agent's conversation list
3. **Browse conversations** → See session previews with timestamps and message counts
4. **Click specific conversation** → Loads into "Current Chat" tab + auto-switches back
5. **Continue from history** → Previous conversation context restored in current chat

### Journey 4: Multi-Agent Coordination
1. **Agent Hub Page** → Click "Orchestrator Chat" (or mode toggle)
2. **Orchestrator interface** → Plan multi-agent tasks
3. **Switch to individual agents** → Navigate to specific Agent Detail Views
4. **Execute planned tasks** → Work with each agent separately
5. **Return to orchestrator** → Coordinate results and next steps

### Journey 5: Cross-Agent Context Switching
1. **Working with Agent A** → In Agent Detail View "Current Chat"
2. **Need to consult Agent B** → Navigate back to Agent Hub
3. **Click Agent B card** → Opens Agent B's Detail View
4. **Quick consultation** → Ask Agent B specific questions
5. **Return to Agent A** → Previous conversation state intact
6. **Continue original work** → Context preserved, no loss of progress

## Key Design Constraints

### Agent Isolation & Context
- **Orchestrator chat**: Lives in app state (for coordination/planning)
- **Individual agent chats**: Use Claude Code SDK session continuity
- **History separation**: Each agent's history only appears in their detail view
- **Project filtering**: Agent history filtered by their working directory context

### Cross-Platform Distribution
- **Offline capability**: Works without internet for local orchestrator


## UX Design Principles


### Information Hierarchy
- **Agent Hub**: Grid view of all configured agents with status indicators
- **Agent Detail**: Tabbed interface (Current Chat | History) for focused interaction
- **Project Context**: Agent-specific project filtering based on working directory relevance

### Error States & Feedback
- **Loading States**: Prevent infinite loops with `hasAttemptedHistoryLoad` flags and `finally` blocks
- **Error Messages**: Use specific messages like "Could not find the project for this conversation" not generic "failed to load"

## Technical Design Constraints

### State Management Architecture
- **Agent Configuration**: Persistent storage in Electron userData + localStorage fallback
- **Session Isolation**: Each agent maintains separate conversation state to prevent cross-contamination
- **History Filtering**: Remote agent projects filtered by working directory keywords
- **Caching Strategy**: 5-minute cache for remote history to prevent API spam

### Cross-Platform Packaging
- **Path Resolution Bug**: Packaged Electron apps require specific path handling for frontend assets
- **Build Dependency**: Frontend must build without TypeScript compilation to avoid blocking

### Data Flow & APIs

#### Core Chat APIs
- **POST /api/chat** - Main chat endpoint for Claude Code SDK integration
  - Request: `{ message: string, sessionId?: string, requestId: string, allowedTools?: string[], workingDirectory?: string }`
  - Response: Streaming JSON responses from Claude Code SDK
  - Behavior: Uses `sessionId` for conversation continuity within same chat session

- **POST /api/abort/:requestId** - Abort ongoing chat requests
  - Purpose: Cancel long-running Claude operations
  - Response: Immediate request termination

#### Project Management APIs  
- **GET /api/projects** - List available local project directories
  - Response: `{ projects: ProjectInfo[] }` where `ProjectInfo = { path: string, encodedName: string }`
  - Purpose: Project selection for local Claude execution context

#### Remote Agent History APIs (3-endpoint pattern)
- **GET /api/agent-projects** - Get remote agent's available projects
  - Target: Called on remote agent endpoints (e.g., `http://207.254.39.121:8080/api/agent-projects`)
  - Response: `{ projects: ProjectInfo[] }`
  - Purpose: Discover which projects have conversation history on remote agent

- **GET /api/agent-histories/:encodedProjectName** - Get conversation summaries for a project
  - Target: Remote agent endpoint
  - Response: `{ conversations: ConversationSummary[] }`
  - `ConversationSummary = { sessionId: string, startTime: string, lastTime: string, messageCount: number, lastMessagePreview: string }`

- **GET /api/agent-conversations/:encodedProjectName/:sessionId** - Get full conversation details
  - Target: Remote agent endpoint  
  - Response: `ConversationHistory = { sessionId: string, messages: unknown[], metadata: object }`
  - Purpose: Load complete conversation for display in agent's current chat tab

#### Data Types & Attribution
- **Message Attribution**: All messages tagged with originating agentId to prevent cross-contamination
- **Working Directory Context**: Agent's codebase determines Claude execution environment
- **Request Tracking**: `requestId` enables request abortion and prevents duplicate operations

## Critical Implementation Notes

### Agent History UX Pattern
```
AgentDetailView tabs: [Current Chat] [History]
- History tab: Shows agent-specific conversation list
- Click conversation → loads into Current Chat tab
- Auto-switch back to Current Chat after loading
```

### State Management Patterns
- **Infinite Loop Prevention**: Use attempt flags for one-time loading operations
- **Loading State Management**: Always reset loading states in finally blocks
- **Path Resolution**: Packaged Electron apps require relative path handling from __dirname

