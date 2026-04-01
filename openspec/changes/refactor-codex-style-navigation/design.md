## Context
GLMX currently splits navigation responsibilities across:
- `AgentsLayout`: owns the outer left resizable sidebar and settings mode
- `AgentsSidebar`: large workspace/chat navigation surface with actions and project context
- `AgentsSubChatsSidebar`: a second chat-oriented navigation surface inside main content
- `DetailsSidebar`: another persistent side panel for files, plan, terminal, diff, and metadata

The result is functionally rich but visually crowded. Users perceive this as "two nav bars and one chat frame" even though the panels serve different roles.

## Goals
- Make the desktop shell feel closer to Codex: one clear left navigation system and one primary chat canvas.
- Preserve all existing productivity features.
- Reduce simultaneous panel competition on first glance.
- Keep implementation incremental so the app remains runnable after each step.

## Non-Goals
- Rewriting chat/session architecture
- Removing sub-chats, diff, terminal, or details features
- Replacing the existing atoms/state model wholesale
- Redesigning automations or settings beyond what is needed for shell coherence

## Proposed Structure

### 1. Unified Left Navigation
The left side should become one navigation shell composed of:
- top utility row: new thread, plugins/automations/settings access, collapse behavior
- workspace/project grouping
- current thread list
- contextual sub-thread area when inside a selected chat

Instead of rendering `AgentsSidebar` and `AgentsSubChatsSidebar` as separate competing regions, the sub-chat navigation should be rendered as a contextual layer within the primary left shell.

### 2. Contextual Thread Hierarchy
The shell should show:
- top-level chats when no chat is focused
- selected chat plus its sub-chats when inside a conversation

This preserves discoverability while matching the Codex mental model: one sidebar that changes context, not two permanent nav columns.

### 3. Feature Panels Become Secondary
`DetailsSidebar` should remain available, but it should behave as a secondary inspection surface rather than a constant competitor with navigation.

Preferred behavior:
- hidden by default on first load
- opened intentionally for files, plan, terminal, diff, or metadata
- restorable by keyboard shortcuts and visible affordances

### 4. State Compatibility
The refactor should continue to respect:
- `agentsSidebarOpenAtom`
- selected chat and project atoms
- sub-chat store state
- settings and desktop view modes
- existing hotkeys

Where possible, this should be a composition change rather than a state-model rewrite.

## Risks
- Existing hotkeys may assume sidebars are independent.
- Users may rely on seeing sub-chats and details simultaneously.
- Some rendering assumptions in `AgentsContent` may depend on the current nested layout.

## Rollout Strategy
1. First unify the left shell while keeping existing content components.
2. Then convert sub-chat navigation into contextual content inside the unified shell.
3. Finally reduce default visibility of details panels and add stronger open/close affordances.

