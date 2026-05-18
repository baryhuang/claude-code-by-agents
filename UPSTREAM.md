# Upstream

This repository is a Claude-Code-branded distribution of [OpenAgents Go](https://github.com/openagentsorg/openagents) (the `packages/go` Swift universal app).

## Vendored source

- **Upstream repo**: `openagentsorg/openagents`
- **Upstream path**: `packages/go/`
- **Source commit**: `c64562bd9eb8f25ec17e46db6f4790041927497f`
- **Source commit subject**: `feat(channels): iMessage-style channel members sheet`
- **Vendored on**: 2026-05-17

## What's vendored

Copied verbatim from upstream:

- `OpenAgents/` — Swift sources (Models, Networking, State, Views, Helpers, etc.)
- `project.yml` — xcodegen configuration (modified, see below)
- `docs/` — screenshots

## Local deltas from upstream

- `project.yml`:
  - `PRODUCT_NAME` set to `Claude Code Agentrooms`
  - `PRODUCT_BUNDLE_IDENTIFIER` set to `com.agentrooms.app` (in-place upgrade over the prior Electron build)
  - `MARKETING_VERSION` reset to `1.0.0`
- Default workspace endpoint unchanged from upstream (`https://workspace-endpoint.openagents.org`).

## Resync policy

Manual diff-and-merge. To resync from upstream:

```sh
# In a separate openagents checkout
cd /path/to/openagents
git fetch origin && git log -1 --format='%H' -- packages/go

# Diff against your vendored copy
diff -r /path/to/openagents/packages/go/OpenAgents ./OpenAgents
diff /path/to/openagents/packages/go/project.yml ./project.yml
```

Reapply the local deltas (above) after each resync.
