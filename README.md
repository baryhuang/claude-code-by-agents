# Agentrooms

Native macOS + iOS app for coordinating multiple coding-agent instances across local and remote machines. Start with Claude Code, add Codex or custom runtimes, route work with `@agent-name` mentions, and see every agent's work in one threaded room.

> **Agentrooms × [OpenAgents](https://openagents.org)** — repo: **<https://github.com/openagentsorg/openagents>**
>
> The Swift app is co-developed between this coding-agent-focused distribution and [OpenAgents Go](https://github.com/openagentsorg/openagents/tree/main/packages/go). Same source, same architecture, two brands shipping to two audiences. Some screenshots and in-app strings still say "OpenAgents Go" because the app surface is shared — Agentrooms owns the agent room experience, OpenAgents owns the workspace backplane.

<img src="docs/screenshot.png" alt="Claude Code Agentrooms on macOS — iMessage-style 2-pane layout (shared UI with OpenAgents Go)" width="720" />

> **v0.2.x is a full rewrite.** Earlier versions (Electron + Deno backend + React frontend) shipped through `v0.1.x`. The pre-rewrite stack is preserved on the `pre-v1-archive` tag. v0.2.x onwards is the OpenAgents Go Swift universal app, distributed for the Claude Code use case — versions are kept in lockstep with the OpenAgents Go upstream, see [UPSTREAM.md](UPSTREAM.md).

## Vision: one room for many coding agents

Coding agents are most useful when they can run in parallel: one per repo, role, machine, runtime, or task style. A frontend agent can live on your laptop, an infra agent on a Mac mini, an ML agent on a GPU box, and a reviewer agent on a build server. The hard part is no longer starting one agent; it is keeping many of them addressable, visible, and coordinated.

**Agentrooms is the room for that work.** One threaded UI where every coding agent is reachable by name, every request lands in the same place it was asked, and every runtime speaks through the same OpenAgents workspace protocol.

Three principles drive the design:

- **Multi-instance by default.** Run several Claude Code, Codex, or custom agents at once, each with its own working directory, machine, permissions, and tools.
- **Provider-agnostic backplane.** Agentrooms is the client; OpenAgents is the workspace protocol. Claude Code is the first-class path today, while Codex and custom runtimes can join the same room.
- **Direct routing, shared context.** Use `@frontend`, `@backend`, `@codex-review`, or any agent name to route work explicitly. Coordination happens in the room, with agents as peers on the same backplane.

The substrate is a three-layer architecture: a **workspace layer** (the OpenAgents backend — events, channels, attachments, history), an **interaction layer** (this app, plus channel adapters), and a **runtime layer** (independent agents running via [`@openagents-org/agent-connector`](https://www.npmjs.com/package/@openagents-org/agent-connector)). The Claude Code workflow is the first deep wedge — `@frontend`, `@backend`, `@ml`, `@infra` agents running on the right machines from one room. The same substrate supports Codex, MCP-backed agents, and custom runtimes by swapping the runtime on layer 3.

What this is *not*: a replacement for human judgment on irreversible decisions, an automator of physical work, or a chat UI bolted onto an existing app.

**→ [Read the full vision and roadmap](VISION.md)** for the architecture diagram, the principles in depth, and the near/mid/long-term plan.

## How it works

```
┌──────────────────────────┐         ┌────────────────────────────┐
│ Claude Code Agentrooms   │  HTTPS  │ OpenAgents workspace        │
│ (this app, macOS/iOS)    │ ──────▶ │ (workspace-endpoint.        │
│                          │         │  openagents.org or your own)│
└──────────────────────────┘         └────────────────────────────┘
                                                  │ /v1/discover
                                                  │ /v1/events
                                                  ▼
                            ┌─────────────────────────────────────┐
                            │ Remote machines running             │
                            │ @openagents-org/agent-connector     │
                            │ with claude, codex, or custom       │
                            │ runtimes authorized                 │
                            └─────────────────────────────────────┘
```

The app is the UI. The workspace endpoint is the backplane. Your coding agents run wherever you install `agent-connector`.

## Setup

### 1. Install the app

Download the latest `.dmg` from [Releases](https://github.com/baryhuang/claude-code-by-agents/releases) (Apple Silicon).

iOS: TestFlight link coming with v1.1.

### 2. Set up an agent on a remote machine

On any machine where you want an agent to run (a Mac mini, a cloud instance, your laptop):

```sh
npm install -g @openagents-org/agent-connector

# Install the Claude runtime
agent-connector install claude

# Create an agent named e.g. "backend"
agent-connector create backend --type claude

# Authorize: agent-connector handles Claude OAuth for you on this machine
# Follow the prompts.

# Start the daemon
agent-connector up
```

Codex and custom runtime support use the same workspace model as they become available through `agent-connector`.

### 3. Connect the agent to a workspace

You'll need a workspace URL with a token. Either:

- Use the public OpenAgents workspace at `https://workspace-endpoint.openagents.org` — sign in via the OpenAgents site to get a workspace + token, or
- Self-host the OpenAgents workspace backend (see [openagents/workspace](https://github.com/openagentsorg/openagents)).

```sh
agent-connector connect backend <workspace-token>
```

### 4. Open the app, paste the workspace URL

Launch Claude Code Agentrooms → paste your workspace URL (with `?token=`) into the selector → the app discovers your connected agents via `/v1/discover` and lists them.

## Usage

**One agent:** `@backend add a /healthz endpoint`

**Multiple agents:** `@frontend update the login page, then @backend wire up the new auth route` — the app routes each `@mention` to the right runtime.

## Build from source

Requires Xcode 16+ and [xcodegen](https://github.com/yonaskolb/XcodeGen).

```sh
brew install xcodegen
git clone https://github.com/baryhuang/claude-code-by-agents.git
cd claude-code-by-agents
xcodegen generate
open Agentrooms.xcodeproj
```

Build an ad-hoc signed DMG:

```sh
xcodebuild -project Agentrooms.xcodeproj -scheme Agentrooms \
  -configuration Release -derivedDataPath build/dd \
  CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO build

STAGING=$(mktemp -d)
cp -R "build/dd/Build/Products/Release/Claude Code Agentrooms.app" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
mkdir -p dist
hdiutil create -fs HFS+ -srcfolder "$STAGING" \
  -volname "Claude Code Agentrooms 0.2.6" \
  -format UDZO -ov "dist/Agentrooms-0.2.6-arm64.dmg"
```

## Architecture

See [UPSTREAM.md](UPSTREAM.md) for the source provenance and resync policy.

The app is ~1MB on disk. State lives in `WorkspaceStore` (one per connected workspace). All HTTP goes through `WorkspaceAPI` (an actor). No SSE/WebSocket — adaptive polling (1.5–3s for active threads, 5–15s for discovery). UI is SwiftUI with an iMessage-style 2-pane layout on macOS/iPad and push/pop navigation on iPhone.

## License

MIT
