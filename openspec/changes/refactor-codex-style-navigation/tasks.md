## 1. Navigation Shell Refactor
- [ ] 1.1 Audit the current desktop shell state flows across `AgentsLayout`, `AgentsContent`, `AgentsSidebar`, and `AgentsSubChatsSidebar`.
- [ ] 1.2 Replace the two-left-nav structure with a unified Codex-style navigation shell that keeps primary actions, project/workspace grouping, and thread listing in one consistent region.
- [ ] 1.3 Reframe sub-chats as contextual thread content rather than a separate always-competing navigation column.

## 2. Feature Preservation
- [ ] 2.1 Preserve access to details, files, plan, terminal, and diff features through contextual panels or toggles.
- [ ] 2.2 Preserve settings, automations, onboarding, and workspace switching without introducing hidden dead ends.
- [ ] 2.3 Preserve current keyboard shortcuts and restore any regressions caused by layout changes.

## 3. Responsiveness and States
- [ ] 3.1 Design clear collapsed, empty, and missing-workspace states for the unified shell.
- [ ] 3.2 Ensure narrow-width and mobile-adjacent desktop states do not reintroduce stacked competing panels.

## 4. Verification
- [ ] 4.1 Run `npm run build`.
- [ ] 4.2 Manually verify project selection, chat selection, sub-chat switching, diff review, terminal access, and settings navigation.
- [ ] 4.3 Confirm no core feature becomes unreachable after the shell simplification.

