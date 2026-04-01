# GLMX Implementation Checklist

## PR 1 — Provider Routing & OpenAI-Compatible Stability
- [ ] Verify in-app end-to-end: choose 9router, new chat, confirm model in logs *(manual test)*
- [x] Add regression test for slot mapping + thinking level conversion → `src/renderer/features/agents/lib/__tests__/models.test.ts`

## PR 2 — Desktop Boot & Loading Reliability
- [ ] Verify packaged app startup: no loading freeze after selecting folder *(manual test)*
- [ ] Verify no React max-depth loop in normal boot path *(manual test)*

## PR 3 — Sidebar Workspace / Branch / MCP Reliability
- [x] Add remote/local grouping + search in Details sidebar branch dropdown *(already implemented — type badges "local"/"remote" with filter)*
- [x] Add branch switch success/failure toast feedback → `new-chat-form.tsx:2124` toast on branch select

## PR 4 — Thinking UX & Visual Consistency
- [x] Remove remaining legacy naming strings in renderer labels/tooltips
  - MCP settings tab: `CODEX` → `OPENAI-COMPATIBLE` (`agents-mcp-tab.tsx`)
  - Billing page: `Codex Subscription` → `OpenAI-Compatible Subscription` (`billing-method-page.tsx`)
  - Error messages: `Codex authentication required` → `OpenAI-compatible authentication required` (`acp-chat-transport.ts`)
  - Error messages: `Codex login failed` → `OpenAI-compatible login failed` (`use-codex-login-flow.ts`)
- [x] Final typography/spacing pass for long reasoning blocks → `agent-thinking-tool.tsx`
  - Increased preview length: 60 → 80 chars
  - Expanded streaming max-height: 144px → 192px for longer reasoning
  - Added vertical padding `py-1` for content breathing room
  - Adjusted header padding `py-0.5` → `py-1` for better click target

## Follow-up Hardening
- [x] Add smoke script: dev boot → select workspace → start chat → switch branch → MCP test → `scripts/smoke-test.sh`
- [x] Add packaged smoke script: launch app → confirm renderer mount/log file → `scripts/smoke-test-packaged.sh`
- [x] Add Review guard when chat has no valid worktree path *(already implemented → `changes-view.tsx:821-833`)*
- [x] Add fallback mode for Review: agent-produced file list when git diff unavailable *(already implemented → `changes-view.tsx:798-819`)*
