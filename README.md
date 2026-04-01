# GLMX

`GLMX` is a `ZAI Agent` desktop fork focused on running the local coding agent workflow with Z.AI-backed GLM models through the Claude Code-compatible route.

This fork keeps the core desktop experience from the upstream app:

- multi-pane coding agent UI
- local project selection
- diff preview and approval
- terminal output
- git panel and commit flow
- Claude/Codex runtime integration

The main change is the onboarding and configuration flow:

- no hosted account onboarding is required to open the app
- the app asks for a ZAI API key on first launch
- ZAI settings are persisted locally
- model routing is written into `~/.claude/settings.json`

## What This Fork Does

- replaces hosted onboarding with local ZAI onboarding
- stores ZAI config in app user data
- syncs ZAI environment values into `~/.claude/settings.json`
- adds a settings section for updating the key and GLM model mapping
- strips hosted branding, analytics, and update checks from the desktop flow

## Default ZAI Mapping

The app writes these defaults unless you change them in Settings:

- Base URL: `https://api.z.ai/api/anthropic`
- Heavy model: `glm-4.7`
- Standard model: `glm-4.7`
- Fast model: `glm-4.5-air`

For GLM Coding Plan usage, keep the same Base URL and remap the three Claude Code slots to the GLM family you want, for example:

- Heavy model: `glm-5.1`
- Standard model: `glm-5`
- Fast model: `glm-5-turbo`

## First Launch Flow

1. Open the app
2. Paste your ZAI API key
3. Click `Start`
4. Pick a local project folder
5. Start using the agent

The app remembers your config between launches.

## Development

### Prerequisites

- Bun
- Node.js
- macOS, Linux, or Windows build tooling required by Electron native modules

### Install

```bash
bun install
bun run claude:download
bun run codex:download
```

### Run in Dev

```bash
bun run dev
```

### Production Build

```bash
bun run build
```

Optionally package the desktop app:

```bash
bun run package:mac
# or
bun run package:win
# or
bun run package:linux
```

## Key Files

- `src/main/lib/zai-config.ts`
  local ZAI config persistence and sync into Claude settings

- `src/main/lib/trpc/routers/zai.ts`
  tRPC procedures for reading and saving ZAI config

- `src/renderer/features/onboarding/zai-onboarding-page.tsx`
  first-run onboarding screen for entering the ZAI key

- `src/renderer/components/dialogs/settings-tabs/agents-models-tab.tsx`
  settings UI for editing the saved key and model mapping

- `src/renderer/App.tsx`
  root renderer gate that decides whether to show onboarding or the workspace

## Notes

- This repo is intended for local desktop usage.
- Some upstream web/cloud features are intentionally disabled or no-op in this fork.
- The runtime still relies on the bundled agent binaries downloaded by the setup scripts.

## License

Apache License 2.0. See [LICENSE](LICENSE).
