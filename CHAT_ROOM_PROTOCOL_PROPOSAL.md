# Multi-Agent Chat Room Protocol Proposal

## Overview

This proposal extends Agentrooms to use the **common chat room text as a communication protocol** between different AI service providers. The core insight is that agents can coordinate through structured messages in the shared chat interface, creating a natural multi-agent workflow.

## Core Concept: Chat Room as Protocol

Instead of complex file handoffs or APIs, agents communicate through **structured messages** in the main chat room:

```
User: @ux-agent Please analyze this login form UI
UX Agent: **UX_ANALYSIS** This form lacks visual hierarchy...
User: @impl-agent Use the analysis above to improve the form
Impl Agent: **IMPLEMENTATION** Based on the UX analysis, I'm updating...
```

## Target Workflow: OpenAI UX + Claude Implementation

### Happy Path Scenario

1. **Claude Code Agent** captures webapp screenshot and sends to chat
2. **OpenAI UX Agent** reads chat history, analyzes screenshot, provides UX critique
3. **Claude Code Agent** reads UX feedback from chat, implements improvements
4. **Repeat cycle** until both agents are satisfied

### Sample Chat Flow

```
@claude-impl capture screenshot of /dashboard page

Claude Impl: **SCREENSHOT_CAPTURE**
[Image: dashboard.png]
Current dashboard implementation showing user stats and navigation

@openai-ux analyze the dashboard screenshot for UX improvements

OpenAI UX: **UX_ANALYSIS**
Dashboard Issues Found:
1. Poor visual hierarchy - stats cards compete for attention
2. Navigation lacks clear primary action
3. Color contrast insufficient for accessibility 
4. Missing empty states for new users

Recommendations:
- Reduce stats card visual weight
- Add prominent CTA button
- Improve contrast ratios to WCAG AA
- Design welcome flow for first-time users

@claude-impl implement the UX recommendations above

Claude Impl: **IMPLEMENTATION_START**
Implementing UX improvements based on analysis:
1. Updating stats cards with lighter styling
2. Adding primary "Create Project" CTA button
3. Adjusting color palette for better contrast
4. Creating new user onboarding component

[Shows code changes and final result]

@openai-ux review the updated implementation

OpenAI UX: **UX_REVIEW**
Much improved! The hierarchy is now clear and accessible.
Minor suggestion: Increase button padding by 4px for better touch targets.
Overall rating: 8/10 - ready for user testing.
```

## Technical Architecture

### Backend Provider Abstraction

Extend existing `chat.ts` handler to support multiple AI providers:

```typescript
interface AgentProvider {
  type: 'claude-code' | 'openai-chat' | 'anthropic-direct';
  executeRequest(message: string, context: ChatContext): AsyncGenerator<StreamResponse>;
}

class OpenAIProvider implements AgentProvider {
  type = 'openai-chat';
  
  async* executeRequest(message: string, context: ChatContext) {
    // Convert chat history to OpenAI format
    const messages = this.buildContextFromChatHistory(context.chatHistory);
    
    // Make OpenAI API call with system prompt for UX analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview", // For image analysis
      messages: [
        { role: "system", content: UX_ANALYST_SYSTEM_PROMPT },
        ...messages
      ],
      stream: true
    });
    
    // Stream responses in Agentrooms format
    for await (const chunk of response) {
      yield this.convertToStreamResponse(chunk);
    }
  }
}
```

### Agent Configuration Extension

Extend existing `Agent` interface to support different providers:

```typescript
interface Agent {
  id: string;
  name: string;
  workingDirectory: string;
  color: string;
  description: string;
  isOrchestrator?: boolean;
  
  // New fields
  provider: 'claude-code' | 'openai-chat' | 'anthropic-direct';
  apiEndpoint?: string; // For remote Claude Code agents
  apiKey?: string; // For direct API providers
  systemPrompt?: string; // Provider-specific instructions
  capabilities: string[]; // ['screenshot', 'code', 'ux-analysis', 'design']
}
```

### Chat History Context Injection

When an agent is mentioned, inject relevant chat history as context:

```typescript
function buildAgentContext(message: string, chatHistory: Message[]): ChatContext {
  const relevantHistory = chatHistory
    .filter(msg => msg.type === 'user' || msg.agentId) // Include user + all agent messages
    .slice(-20); // Last 20 messages for context
    
  return {
    currentMessage: message,
    chatHistory: relevantHistory,
    mentionedAgents: extractMentions(message),
    attachments: extractAttachments(chatHistory) // Screenshots, files, etc.
  };
}
```

### Screenshot/Image Handling

Enhance Claude Code agents to capture and share screenshots:

```typescript
// Add to Claude Code system prompt
const CLAUDE_SCREENSHOT_PROMPT = `
You have access to screenshot tools. When asked to capture a screenshot:
1. Use the screenshot tool to capture the current page
2. Respond with **SCREENSHOT_CAPTURE** followed by description
3. Include the image in your response for other agents to analyze
`;

// OpenAI Vision Analysis
const UX_ANALYST_SYSTEM_PROMPT = `
You are a UX Designer analyzing web interfaces. When you see screenshots:
1. Start responses with **UX_ANALYSIS** 
2. Identify specific usability issues
3. Provide concrete, actionable recommendations
4. Rate the overall UX from 1-10

Focus on: visual hierarchy, accessibility, user flow, and conversion optimization.
`;
```

## Implementation Steps

### Phase 1: Multi-Provider Backend (Week 1-2)
- Add `AgentProvider` abstraction layer
- Implement `OpenAIProvider` class
- Extend chat handler to route based on agent provider type
- Add chat history context injection

### Phase 2: Agent Configuration UI (Week 2-3)
- Update Agent configuration form with provider selection
- Add API key management (secure storage)
- Add capability tags to agent cards
- Test OpenAI + Claude Code coordination

### Phase 3: Enhanced Protocols (Week 3-4)
- Add structured message parsing (`**UX_ANALYSIS**`, `**IMPLEMENTATION**`, etc.)
- Implement screenshot capture and sharing
- Add image analysis capabilities for OpenAI agents
- Create feedback loop detection

### Phase 4: Workflow Optimization (Week 4-5)
- Add conversation threading (group related messages)
- Implement smart agent suggestions based on capabilities
- Add workflow templates for common patterns
- Performance optimization and error handling

## Benefits of Chat Room Protocol

### ✅ **Natural Communication**
- Agents communicate how humans would - through conversation
- Easy to understand, debug, and extend workflows
- No complex file formats or API translations needed

### ✅ **Context Preservation**
- Full conversation history available to all agents
- Decisions and reasoning are transparent and traceable
- Easy to resume interrupted workflows

### ✅ **Human Oversight**
- Users can intervene at any point in the conversation
- Clear visibility into what each agent is doing
- Natural handoff between agents and humans

### ✅ **Flexible Coordination**
- Agents can involve additional specialists as needed
- No rigid workflow definitions - adapt based on conversation
- Easy to add new agent types and capabilities

### ✅ **Leverages Existing Infrastructure**
- Builds on proven Agentrooms chat system
- Reuses existing message routing and session management
- No fundamental architecture changes needed

## Example Agent Configurations

```typescript
const AGENTS: Agent[] = [
  {
    id: "claude-impl",
    name: "Claude Code (Implementation)",
    provider: "claude-code",
    apiEndpoint: "http://remote-claude-server:8080",
    capabilities: ["code", "screenshot", "implementation", "testing"],
    systemPrompt: "You are a senior developer. Capture screenshots when analyzing UIs.",
    workingDirectory: "/app",
    description: "Full-stack implementation with screenshot capabilities"
  },
  {
    id: "openai-ux", 
    name: "OpenAI UX Designer",
    provider: "openai-chat",
    capabilities: ["ux-analysis", "design-critique", "vision"],
    systemPrompt: UX_ANALYST_SYSTEM_PROMPT,
    workingDirectory: "/tmp/ux-analysis",
    description: "UX analysis and design recommendations with vision capabilities"
  },
  {
    id: "orchestrator",
    name: "Orchestrator Agent", 
    provider: "anthropic-direct",
    capabilities: ["coordination", "planning", "workflow"],
    isOrchestrator: true,
    description: "Coordinates multi-agent workflows and planning"
  }
];
```

## Why This Approach Works

### **Realistic and Implementable**
- Uses existing Agentrooms infrastructure 
- Minimal changes to current backend architecture
- No complex file coordination or external dependencies

### **Immediate Value**
- Works with simple OpenAI API integration
- Provides concrete UX → Implementation workflow
- Easy to test and validate with real scenarios

### **Natural Extension**
- Chat room is already the central coordination mechanism
- Structured messages provide protocol without complexity
- Human-readable and debuggable workflows

### **Scalable Foundation**
- Easy to add new providers (Anthropic direct, Gemini, etc.)
- Capability-based routing allows smart agent selection  
- Conversation threading enables complex multi-agent orchestration

This proposal delivers what you asked for: **OpenAI as UX designer + Claude Code as implementer, both remote agents, using the chat room as their communication protocol**. The screenshot capture → UX analysis → implementation cycle provides immediate, tangible value while building on Agentrooms' existing strengths.