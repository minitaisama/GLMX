# GLMX Implementation Checklist

This checklist tracks feature work shipped as separate PRs.

## PR 1 — Provider Routing & OpenAI-Compatible Stability

- [x] Normalize OpenAI-compatible model slot mapping for ACP (`heavy|standard|fast`)
- [x] Fix provider routing handoff for 9router/OpenAI-compatible flow
- [x] Keep ACP slot model IDs stable to avoid invalid model selection
- [ ] Verify in-app end-to-end: choose 9router, new chat, confirm model in logs *(manual test)*
- [x] Add regression test for slot mapping + thinking level conversion → `src/renderer/features/agents/lib/__tests__/models.test.ts`

## PR 2 — Desktop Boot & Loading Reliability

- [x] Add explicit renderer boot state machine (`checking_config` → `ready`)
- [x] Add persisted-state sanitizer before renderer mount
- [x] Add boot timeout fallback to prevent infinite loading screen
- [x] Add renderer/main logging initialization for packaged diagnostics
- [ ] Verify packaged app startup: no loading freeze after selecting folder *(manual test)*
- [ ] Verify no React max-depth loop in normal boot path *(manual test)*

## PR 3 — Sidebar Workspace / Branch / MCP Reliability

- [x] Make Branch row a real clickable dropdown for branch switching
- [x] Disable branch actions when workspace is not a git repo
- [x] Show clear disabled reason: "This chat is not attached to a local git workspace."
- [x] Add MCP "Configured vs Live" states in widget
- [x] Add "Test MCP" action and show test status/errors
- [x] Add remote/local grouping + search in Details sidebar branch dropdown
- [x] Add branch switch success/failure toast feedback → `new-chat-form.tsx`

## PR 4 — Thinking UX & Visual Consistency

- [x] Apply Codex-like structure for thinking blocks in chat
- [x] Keep heading + body layout consistent for reasoning traces
- [x] Remove remaining legacy naming strings in renderer labels/tooltips
  - MCP settings tab: `CODEX` → `OPENAI-COMPATIBLE` (`agents-mcp-tab.tsx`)
  - Billing page: `Codex Subscription` → `OpenAI-Compatible Subscription` (`billing-method-page.tsx`)
  - Error messages: `Codex authentication required` → `OpenAI-compatible authentication required` (`acp-chat-transport.ts`)
  - Error messages: `Codex login failed` → `OpenAI-compatible login failed` (`use-codex-login-flow.ts`)
- [x] Final typography/spacing pass for long reasoning blocks → `agent-thinking-tool.tsx`
  - Increased preview length: `60 → 80`
  - Expanded streaming max-height window
  - Added vertical padding for readability
  - Improved header hit area

## Follow-up Hardening

- [x] Add smoke script: dev boot → select workspace → start chat → switch branch → MCP test → `scripts/smoke-test.sh`
- [x] Add packaged smoke script: launch app → confirm renderer mount/log file → `scripts/smoke-test-packaged.sh`
- [x] Add Review guard when chat has no valid worktree path *(implemented in `changes-view.tsx`)*
- [x] Add fallback Review mode: agent-produced file list when git diff unavailable *(implemented in `changes-view.tsx`)*
