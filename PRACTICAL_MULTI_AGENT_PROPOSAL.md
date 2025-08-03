# Practical Multi-Agent Proposal: Agentrooms Integration

## Current State Analysis

Agentrooms already provides a sophisticated **multi-agent workspace** with:
- Agent configuration and orchestration
- Direct `@agent-name` mentions for specific routing
- Multi-agent workflows with dependency coordination
- Local + remote agent support
- Real-time streaming communication

## Realistic Integration Proposal

Instead of reinventing the system, let's enhance what exists with **practical integrations**:

### 1. Agent Type Extensions (Immediate)

**Current**: Only Claude Code agents  
**Enhancement**: Support different agent types with specialized capabilities

```typescript
interface Agent {
  id: string;
  name: string;
  type: "claude-code" | "openai-gpt" | "figma-design" | "custom-api"; // New field
  capabilities: string[]; // ["code", "design", "research", "analysis"]
  apiEndpoint: string;
  workingDirectory: string;
  // Existing fields...
}
```

### 2. API Adapter Pattern (1-2 weeks)

**Instead of**: Complex workflow orchestration  
**Implementation**: Simple API adapters for different services

```typescript
// Backend adapters for different agent types
class OpenAIAdapter implements AgentAdapter {
  async sendMessage(message: string): Promise<StreamResponse> {
    // Convert Agentrooms format to OpenAI API
    // Handle streaming responses consistently
  }
}

class FigmaAdapter implements AgentAdapter {
  async sendMessage(designRequest: string): Promise<StreamResponse> {
    // Interpret design requests
    // Generate Figma components/wireframes
    // Return design URLs and descriptions
  }
}
```

### 3. Enhanced Agent Mentions (1 week)

**Current**: `@agent-name basic-message`  
**Enhancement**: Structured agent commands

```
@design-agent create login form with email, password, and remember-me checkbox
@gpt-4 analyze user requirements for shopping cart feature  
@claude-code implement the authentication logic based on the design
```

### 4. Artifact Handoffs (2-3 weeks)

**Instead of**: Complex file-based coordination  
**Implementation**: Simple artifact passing between agents

```typescript
interface Artifact {
  id: string;
  type: "design" | "requirements" | "code" | "analysis";
  agentId: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: number;
}

// Usage example:
// 1. @gpt-4 creates requirements artifact
// 2. @design-agent references requirements to create design artifact  
// 3. @claude-code references both to implement
```

### 5. Agent Capability Discovery (1 week)

Add agent capability advertising so the orchestrator knows what each agent can do:

```typescript
// Each agent announces capabilities
const capabilities = {
  "design-agent": ["wireframes", "ui-components", "design-systems"],
  "gpt-4-agent": ["requirements", "user-stories", "analysis", "planning"],
  "claude-code": ["implementation", "debugging", "refactoring", "testing"]
};
```

## Implementation Strategy

### Phase 1: Core Infrastructure (2 weeks)
- [ ] Add agent type support to configuration
- [ ] Create basic API adapter interface
- [ ] Implement OpenAI adapter for proof-of-concept

### Phase 2: Enhanced Messaging (1 week)  
- [ ] Structured agent command parsing
- [ ] Agent capability discovery system
- [ ] Enhanced routing based on capabilities

### Phase 3: Artifact System (2-3 weeks)
- [ ] Simple artifact storage and retrieval
- [ ] Agent-to-agent artifact references
- [ ] Artifact visualization in UI

### Phase 4: Specialized Agents (ongoing)
- [ ] Figma integration agent (when API available)
- [ ] Specialized coding agents (different languages/frameworks)
- [ ] Analysis and documentation agents

## Why This Approach Works

1. **Builds on existing infrastructure** - No reinvention
2. **Incremental implementation** - Each phase adds value
3. **Backward compatible** - Existing Claude Code agents work unchanged
4. **Real user value** - Each enhancement solves actual workflow problems
5. **Feasible scope** - Can be implemented by small team in 2-3 months

## Success Metrics

- **Agent diversity**: Number of different agent types configured
- **Cross-agent workflows**: Percentage of conversations involving multiple agent types
- **Artifact reuse**: How often artifacts are referenced between agents
- **User adoption**: Active users utilizing multi-agent features

## Technical Requirements

- Extend existing `useAgentConfig` hook for agent types
- Add adapter layer to backend chat handlers
- Simple artifact storage (can use existing conversation history system)
- Enhanced message parsing for structured commands

This proposal focuses on **practical enhancements** to the existing system rather than theoretical multi-service orchestration.