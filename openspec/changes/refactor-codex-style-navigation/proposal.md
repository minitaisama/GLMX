# Change: Refactor GLMX navigation into a Codex-style unified shell

## Why
GLMX currently exposes too much navigation chrome at once: a primary sidebar, a sub-chat sidebar, and an always-available details/chat frame can all compete for attention. This makes the desktop shell feel heavier than the workflows users actually need for chat-first coding.

The goal is to move GLMX toward a Codex-like navigation model: one clear primary navigation rail, one contextual thread/workspace list, and feature panels that appear only when needed. We need to simplify the shell without losing sub-chats, diff review, terminal, files, settings, automations, or workspace-level actions.

## What Changes
- Introduce a unified left navigation shell with a compact top action area and one primary conversation/workspace list.
- Collapse the current dual-sidebar behavior so the sub-chat list becomes contextual content inside the unified navigation flow rather than a second competing navigation frame.
- Keep details, diff, terminal, files, and plan features, but move them behind contextual panels and toggles instead of always-on layout competition.
- Preserve keyboard shortcuts, project selection, multi-chat workflows, and settings access.
- Add clear empty and collapsed states so the shell still works for no-project, no-chat, and narrow-width layouts.

## Impact
- Affected code:
  - `src/renderer/features/layout/agents-layout.tsx`
  - `src/renderer/features/agents/ui/agents-content.tsx`
  - `src/renderer/features/sidebar/agents-sidebar.tsx`
  - `src/renderer/features/sidebar/agents-subchats-sidebar.tsx`
  - `src/renderer/features/details-sidebar/details-sidebar.tsx`
  - related atoms and sidebar state files
- Affected UX:
  - desktop navigation structure
  - chat and sub-chat discoverability
  - sidebar collapse/expand behavior
  - settings and workspace switching affordances

