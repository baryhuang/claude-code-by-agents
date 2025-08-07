# Agentrooms Roadmap

## Vision: Comprehensive Claude Code Ecosystem

Agentrooms aims to bridge the gap between the official Claude Code SDK limitations and developer needs for remote Claude Code control and multi-agent coordination.

## Current Status ✅

### Completed Features
- **Multi-Agent UI**: Desktop app with agent hub and conversation history
- **Remote Agent Control**: HTTP API for controlling remote Claude Code instances
- **OpenAPI Documentation**: Comprehensive Swagger docs at `/api-docs`
- **Session Continuity**: Maintain conversation context across API calls
- **Streaming Support**: Real-time responses via Server-Sent Events
- **Cross-Platform**: macOS, Windows, and Linux desktop applications

### Current Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Desktop UI    │───▶│  Backend API    │───▶│ Remote Claude   │
│   (Electron)    │    │  (Hono/Node.js) │    │ Code Instances  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Phase 1: Standalone SDK Package 🚧

**Target: Q2 2025**

### Objective
Extract the backend service into a standalone, OpenAI-compatible npm package that developers can run without the UI.

### Package Vision
```bash
# Global installation
npm install -g @agentrooms/claude-code-sdk
agentrooms-server --port 8080 --working-directory /path/to/project

# Or via npx
npx @agentrooms/claude-code-sdk --port 8080

# Docker deployment
docker run -p 8080:8080 -v $(pwd):/workspace agentrooms/claude-code-sdk
```

### OpenAI Compatibility Layer
```typescript
// Standard OpenAI format with Agentrooms extensions
POST /v1/chat/completions
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {"role": "user", "content": "Fix the bug in server.ts"}
  ],
  "stream": true,
  "working_directory": "/path/to/project",  // Agentrooms extension
  "tools": ["edit", "bash", "read"],        // Agentrooms extension
  "session_id": "unique-session-id"         // Agentrooms extension
}
```

### Technical Requirements

**Package Structure:**
```
@agentrooms/claude-code-sdk/
├── bin/
│   └── agentrooms-server.js         # CLI entry point
├── lib/
│   ├── server.js                    # Core server logic
│   ├── handlers/                    # Route handlers
│   ├── middleware/                  # OpenAI compatibility layer
│   └── types.js                     # TypeScript definitions
├── docker/
│   └── Dockerfile                   # Container support
└── package.json
```

**Key Features:**
- **Zero UI Dependencies**: Pure API server, no frontend code
- **OpenAI Client Libraries**: Works with existing OpenAI clients in any language
- **Docker Ready**: Official Docker images for cloud deployment
- **Environment Configuration**: Support for .env files and environment variables
- **Health Checks**: Built-in monitoring endpoints for production deployments

### Use Cases Enabled

**CI/CD Integration:**
```yaml
# GitHub Actions example
- name: AI Code Review
  run: |
    docker run --rm -v ${{ github.workspace }}:/workspace \
      agentrooms/claude-code-sdk review-pr --pr-number ${{ github.event.number }}
```

**Custom Applications:**
```python
# Python client example
import openai

client = openai.OpenAI(
    api_key="not-needed-for-claude-code",
    base_url="http://localhost:8080/v1"
)

response = client.chat.completions.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "Analyze this codebase"}],
    extra_body={"working_directory": "/path/to/project"}
)
```

**Microservices Architecture:**
```bash
# Deploy as a service
kubectl apply -f agentrooms-deployment.yaml
```

### Benefits Over Current Solution
- **Language Agnostic**: Any HTTP client can use it (Python, Go, Rust, etc.)
- **Production Ready**: Proper logging, monitoring, error handling
- **Scalable**: Can be deployed as multiple instances behind load balancer
- **Standard Interface**: Familiar OpenAI API format for easy adoption

## Phase 2: Enhanced Multi-Agent Support 🔮

**Target: Q3 2025**

### Agent Orchestration Engine
- **Workflow Definition**: YAML-based multi-agent workflows
- **Dependency Management**: Automatic task dependency resolution
- **State Management**: Persistent workflow state across restarts
- **Error Recovery**: Automatic retry and fallback strategies

### Advanced Features
- **Agent Specialization**: Role-based agent configuration (frontend, backend, devops)
- **Context Sharing**: Intelligent context passing between agents
- **Parallel Execution**: Concurrent task execution where possible
- **Agent Discovery**: Automatic discovery of available agents on network

## Phase 3: Enterprise Features 🏢

**Target: Q4 2025**

### Security & Compliance
- **Authentication**: OAuth2, SAML, and API key management
- **Authorization**: Role-based access control (RBAC)
- **Audit Logging**: Comprehensive audit trails for compliance
- **Data Encryption**: End-to-end encryption for sensitive codebases

### Enterprise Integration
- **LDAP/Active Directory**: Enterprise user management
- **Custom Models**: Support for fine-tuned or private Claude models
- **On-Premise Deployment**: Air-gapped installation support
- **Multi-Tenant**: Isolated workspaces for different teams/projects

## Technical Considerations

### Architecture Evolution

**Current (UI + API):**
```
Frontend ←→ Backend API ←→ Claude Code SDK
```

**Phase 1 (Standalone SDK):**
```
Any Client ←→ OpenAI-Compatible API ←→ Claude Code SDK
```

**Phase 2 (Orchestrated Multi-Agent):**
```
                  ┌─ Agent 1 (Frontend)
Client ←→ Orchestrator ├─ Agent 2 (Backend)
                  └─ Agent N (DevOps)
```

### Backward Compatibility
- Current Agentrooms API endpoints will remain available
- Existing desktop apps will continue to work
- Migration path from current API to OpenAI-compatible format

### Performance Goals
- **Sub-100ms latency** for API routing
- **Streaming responses** within 50ms of first token
- **Concurrent sessions** supporting 100+ simultaneous conversations
- **Resource efficiency** using <512MB RAM for standalone deployment

## Community & Ecosystem

### Developer Experience
- **Comprehensive documentation** with examples in multiple languages
- **Interactive playground** for testing API endpoints
- **Client libraries** for popular programming languages
- **Plugin ecosystem** for popular IDEs and editors

### Open Source Strategy
- **Core open source**: Base functionality remains MIT licensed
- **Premium features**: Advanced enterprise features may require licensing
- **Community contributions**: Clear contribution guidelines and roadmap transparency

## Contributing

Interested in contributing to any of these roadmap items? Check out our [contributing guidelines](CONTRIBUTING.md) and join the discussion in our [GitHub Issues](https://github.com/baryhuang/claude-code-by-agents/issues).

### Priority Areas for Contributors
1. **OpenAI Compatibility Layer**: Implementing the `/v1/chat/completions` endpoint
2. **Docker Support**: Creating production-ready container images
3. **Client Libraries**: SDKs for Python, Go, Rust, and other languages
4. **Documentation**: Tutorials, examples, and integration guides
5. **Testing**: End-to-end testing for multi-agent workflows

---

*This roadmap is subject to change based on community feedback and development priorities. Last updated: January 2025*