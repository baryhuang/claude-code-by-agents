# Vision & Roadmap

> **TL;DR.** Agentrooms is **the multi-instance workspace for coding agents**. Run Claude Code, Codex, and custom runtimes across local and remote machines, then coordinate them from one threaded room with `@agent-name` mentions. Claude Code is the first-class path today; the architecture is provider-agnostic by design through the OpenAgents workspace protocol.

---

## 1. The shift we're betting on

Agentic development is moving from one assistant in one terminal to many specialist agents running at once. The shape is simple: a small number of humans directing a larger number of coding agents, each with its own repo, role, runtime, machine, permissions, and tools.

Three observations that shape this project:

1. **Workflows no longer need their own software.** An LLM-backed *specialist* — a Claude Code agent, a sales agent, a support agent — can be addressed in natural language, has access to the relevant history, and renders only the UI a given request needs. Each new workflow used to spawn its own tool with its own login. Now it spawns a prompt and some tools, addressable from the same inbox the operator already checks.
2. **The bottleneck moves from starting agents to coordinating agents.** When agents do the execution, the constraint is no longer "can I run one coding assistant." It's "how many agent instances can I coordinate without losing context."
3. **Runtime choice should not define the workspace.** Teams will mix Claude Code, Codex, MCP-backed agents, and custom runtimes. The room should preserve history, routing, and interaction patterns even as the runtime behind an agent changes.

The product hypothesis: a developer or team should reach every specialist coding agent the way they reach a collaborator — by name, in a shared room — and the agent should respond with whatever is most useful for *that* exchange (a sentence, a patch, a table, a chart, a button to confirm, a generated document). The room is the coordination surface.

---

## 2. Architecture — three layers

```
┌──────────────────────────────────────────────────────────────────┐
│  Channels of ingress                                             │
│  ─────────────────                                               │
│  Native app  ·  Email  ·  SMS  ·  Voice  ·  Webhook  ·  File     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Layer 2 — Interaction layer                                     │
│  ─────────────────────────                                       │
│  Routes a message to the right specialist agent, renders the     │
│  agent's response inline (text, markdown, generative UI specs),  │
│  preserves thread state, dispatches tool-result events back to   │
│  the agent. This is the surface Agentrooms ships today.          │
└──────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼─────────────────┐
              ▼               ▼                 ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Layer 3 —       │  │  Layer 3 —       │  │  Layer 3 —       │
│  Specialist      │  │  Specialist      │  │  Specialist      │
│  agent A         │  │  agent B         │  │  agent N         │
│                  │  │                  │  │                  │
│  One workflow.   │  │  One workflow.   │  │  One workflow.   │
│  Owns its own    │  │  Owns its own    │  │  Owns its own    │
│  tools, prompt,  │  │  tools, prompt,  │  │  tools, prompt,  │
│  side effects.   │  │  side effects.   │  │  side effects.   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
              │               │                 │
              └───────────────┼─────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1 — Knowledge layer                                       │
│  ──────────────────────                                          │
│  Every channel deposits structured events into a shared          │
│  workspace store. Past conversations, attachments, generated     │
│  artifacts, decisions — all indexed and queryable by any agent   │
│  on layer 3 and any human on layer 2.                            │
└──────────────────────────────────────────────────────────────────┘
```

The three layers map onto the codebase as follows:

| Layer | Implemented by | Status |
|---|---|---|
| **3 — Specialist agents** | [`@openagents-org/agent-connector`](https://www.npmjs.com/package/@openagents-org/agent-connector) daemons running Claude Code (today) or any other runtime (later) | Shipped |
| **2 — Interaction layer** | Agentrooms (this repo) on macOS/iOS, plus the OpenAgents workspace backend's `/v1/events` API | Shipped (chat + generative UI), expanding (multi-channel ingress) |
| **1 — Knowledge layer** | OpenAgents workspace backend — events, channels, attachments, agent state | Shipped (event-native model), expanding (richer indexing + retrieval) |

A few load-bearing properties of this design:

- **Agents are independent.** Each one can be developed, deployed, paused, replaced without touching the others. New ones come online by registering a workspace token; old ones disappear by going offline. The interaction layer discovers them via `/v1/discover` on every refresh.
- **No agent is privileged.** There's no "orchestrator process" that has to be running for any other agent to work. An orchestrator is just another agent that happens to delegate.
- **The knowledge layer is shared.** Every agent sees the same workspace history. A sales agent's decisions and an engineering agent's notes are addressable by the same query.
- **The interaction layer is a thin client.** Agentrooms holds no business logic — only chat state, polling, rendering. The brain is on layer 3, the memory is on layer 1.

---

## 3. Conversation as interface — Generative UI

The chat thread is the application. Everything that would have been a screen, a modal, a form, a dashboard, a wizard, a print-preview — happens inline in the same conversation the user is already in.

Agents emit a structured UI spec (`payload.spec` on a `workspace.message` event), and the client renders it next to or in place of the prose. When the user interacts with the rendered UI (taps a button, picks an option, confirms), a `workspace.tool_result` event flows back to the agent, which continues the conversation.

The components vocabulary is open: the agent sends whatever component types it wants; the client renders the ones it knows and shows a placeholder chip for the rest. There is no "register a new screen in the app" step.

This is the deepest reason the architecture works. The reason a team can adopt a new specialist agent in an afternoon is that it doesn't ship with screens — it ships with a prompt and some tools. Whatever UI a particular request needs, the agent emits and the client draws. The same chat thread serves "show me last quarter's revenue" and "approve PR #4221" and "design a kitchen layout" without any of them being a built-in feature of the client.

Today this runs through [`bipa-app/swiftui-json-render`](https://github.com/bipa-app/swiftui-json-render) (a SwiftUI renderer for JSON UI specs). The vocabulary is intentionally not closed.

---

## 4. Core design principles

These are the rules the codebase tries to hold to, and the rules a partner team adding a new specialist agent should hold to.

| Principle | What it means in practice |
|---|---|
| **Channel-native.** | Email, SMS, voice, in-app — same agent, same memory, same conversation. The agent does not care which transport delivered the message. |
| **Zero new software to learn.** | If a user already uses the system, they should not have to learn the system to adopt the next agent. New capabilities should appear *inside* the chat they already check. |
| **Phased rollout, not big-bang.** | Each agent ships standalone and is useful before the others exist. The org gets value from agent #1 long before agent #N is conceived. |
| **Human-in-the-loop on terminal decisions.** | Agents draft, propose, summarize, search. A human confirms anything that is hard to reverse, ships to a customer, or moves money. |
| **Knowledge is the moat, not the model.** | The reason an agent answers well is that the workspace has clean, structured history. Investments in ingest pipelines compound; investments in prompt tuning don't. |
| **Open vocabulary, closed protocol.** | The set of message types is small (`workspace.message`, `workspace.tool_result`, etc.). The set of component types an agent can render is unbounded. The set of channels an agent can listen on is unbounded. |
| **Don't fragment user attention.** | One inbox per user across all their agents. The app does not become N apps inside one app. |

---

## 5. What this is *not*

A clear scope is half the spec. Things this product is intentionally not going to be:

- **Not a replacement for human judgment.** Agents draft, propose, retrieve, structure. They do not make terminal decisions on irreversible operations.
- **Not accurate on day one.** Day-one accuracy is bounded by the quality and completeness of the ingested knowledge. A workspace with a week of email has a week's worth of context. Accuracy improves monotonically with use.
- **Not an automator of physical work.** The agent can produce a cut list; a person still has to make the cut. The agent can produce a deployment plan; a person still has to ship it.
- **Not a chat UI bolted onto an existing app.** The architecture is the inverse — the chat is the surface, and existing apps become tool integrations agents reach into, not screens humans navigate to.
- **Not opinionated about the LLM.** Layer 3 specialist agents can run Claude Code, codex, or any runtime that can speak the workspace event protocol. Today the default and most-tested path is Claude Code via `agent-connector`.

---

## 6. Roadmap

A roadmap of intent, not a contract. Versions track [OpenAgents Go](https://github.com/openagentsorg/openagents/tree/main/packages/go) in lockstep — see [UPSTREAM.md](UPSTREAM.md).

### Now — shipped in v0.2.x

- Native universal app (macOS 15+ / iOS 18+), ~2 MB
- iMessage-style 2-pane layout on macOS/iPad, push/pop on iPhone
- Multi-workspace support with persisted history
- `@mention`-based routing to specialist agents
- Generative UI rendering (A2UI specs via SwiftUIJSONRender)
- Adaptive HTTP polling (1.5–3 s active thread, 5–15 s discovery)
- Markdown + fenced code blocks + intermediate-step rendering
- Attachments (image, video, audio, PDF, archives) into chat input
- macOS app menu (⌘N new thread, ⌘R refresh, ⌘⇧K switch workspace)
- Self-hostable workspace backend; configurable API base URL

### Near-term — next minor versions

- **Push notifications on iOS** (FCM wired, surface in app — see TODO in upstream README)
- **Voice input** as a first-class channel (the proposal-style "talk to your agent" path, not just typed messages)
- **Richer attachment handling** in agent context (preview, OCR, structured extraction)
- **Knowledge browser** view in the app — search across a workspace's history without needing to remember a thread title
- **Workspace settings** view (currently deferred per the upstream README)

### Mid-term

- **Multi-channel ingress adapters** so a workspace can accept inbound email, SMS, webhooks, and file drops as workspace events — not just messages typed in the app
- **Agent profile view** — what each specialist agent does, what tools it has, what data it can see
- **Additional agent runtimes** beyond Claude Code (codex via `agent-connector install codex`, custom runtimes, third-party MCP servers exposed as specialists)
- **Files / Browser / Connect / Monitor view modes** (deferred from upstream)
- **Per-thread mute, badge counts**, suppression rules for unread surfacing

### Long-term

- The app is the chat client a team checks the way they check email — every specialist agent, every workflow, every history search in one thread list
- Specialist agents are addressable by *anyone* in the org by name, not just the person who set them up
- The "open app X to do workflow Y" pattern is in steady retreat — replaced by "ask the agent that knows about Y"
- New workflows can be onboarded in days, not quarters, because they don't ship with screens

---

## 7. How the Claude Code wedge fits

Why start with Claude Code agents as the first specialist runtime?

- **Existing demand.** This repo's pre-rewrite audience came from "I want a UI on top of Claude Code" — that's the surface area Google sends people to.
- **Tightly scoped specialist.** A Claude Code agent owns one working directory, one task style, has a clear toolset. That's the right size to validate the architecture.
- **Routes to a concrete multi-instance engineering workflow.** A developer or team can have `@frontend`, `@backend`, `@ml`, `@infra`, and `@codex-review` agents — each running on the appropriate machine, each with the appropriate auth and tools — and coordinate them from one room. That's an agent room for engineering built from off-the-shelf parts (Claude Code, Codex, agent-connector, and this app), in an afternoon, with no procurement cycle.

Once the engineering wedge stabilizes, the same client + workspace + agent-connector substrate generalizes by swapping the runtime on layer 3. The interaction layer (this repo) does not change. The durable surface area is the shared agent room: one place to address, observe, and coordinate every specialist agent.

---

## Contributing to the vision

If you're considering building a specialist agent on this stack, the relevant interfaces are:

- **For agent runtimes:** [`@openagents-org/agent-connector`](https://www.npmjs.com/package/@openagents-org/agent-connector) — the daemon that registers your agent with a workspace and translates between your runtime and the workspace event protocol.
- **For UI components:** the A2UI / SwiftUIJSONRender vocabulary — agents emit `payload.spec`, the client renders. New component types degrade gracefully.
- **For the client:** this repo. Vendored from [OpenAgents Go](https://github.com/openagentsorg/openagents/tree/main/packages/go) — see [UPSTREAM.md](UPSTREAM.md) for the resync policy.

Issues and discussions welcome at [github.com/baryhuang/claude-code-by-agents](https://github.com/baryhuang/claude-code-by-agents). Architectural questions that touch the workspace backplane should go upstream to [openagentsorg/openagents](https://github.com/openagentsorg/openagents).
