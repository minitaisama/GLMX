# GLMX Implementation Checklist

This checklist tracks feature work that should be shipped as separate PRs.

## PR 1: Provider Routing and OpenAI-Compatible Stability

- [x] Normalize OpenAI-compatible model slot mapping for ACP (`heavy|standard|fast`)
- [x] Fix provider routing handoff for 9router/OpenAI-compatible flow
- [x] Keep ACP slot model IDs stable to avoid invalid model selection
- [ ] Verify end-to-end in app: select 9router + start new chat + confirm model in logs
- [ ] Add regression test for model slot mapping and thinking level conversion

## PR 2: Desktop Boot and Loading Reliability

- [x] Add explicit renderer boot state machine (`checking_config` -> `ready`)
- [x] Add persisted-state sanitizer before renderer mount
- [x] Add boot timeout fallback to prevent infinite loading screen
- [x] Add renderer/main logging initialization for packaged diagnostics
- [ ] Verify packaged app startup: no loading freeze after folder selection
- [ ] Verify no React max-depth loop in normal boot path

## PR 3: Sidebar Workspace, Branch, and MCP Reliability

- [x] Make Branch row a real clickable dropdown for branch switching
- [x] Disable branch actions when workspace is not a git repo
- [x] Show clear disabled reason: "This chat is not attached to a local git workspace."
- [x] Add MCP "Configured vs Live" states in widget
- [x] Add "Test MCP" action and show test status/errors
- [ ] Add remote + local branch grouping/search in Details sidebar dropdown
- [ ] Add branch switch result toast (success/failure) for better UX feedback

## PR 4: Thinking UX and Visual Consistency

- [x] Apply codex-like structure for thinking blocks in chat
- [x] Keep heading + body layout consistent for reasoning traces
- [x] Update app naming/branding to GLMX in desktop shell
- [ ] Remove remaining legacy naming strings from renderer-only labels
- [ ] Final pass on chat typography/spacing for long reasoning blocks

## Follow-up Hardening

- [ ] Add smoke script: dev boot, select workspace, start chat, switch branch, run MCP test
- [ ] Add packaged smoke script: app launch + renderer mount + log file existence
- [ ] Add "Review disabled" guard when chat has no valid worktree path
