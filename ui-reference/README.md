# GLMX UI Reference

This is a **design prototype only** for the GLMX desktop coding agent UI.

## Important notes

- **Not wired to real runtime logic** — all data is hardcoded/placeholder
- **Not the source of truth for model/runtime config** — actual config lives in `src/main/lib/zai-config.ts`
- This prototype is meant to guide the visual and UX direction for integrating new UI into the Electron app

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4 + Radix UI primitives
- Dark-only theme, GitHub-inspired palette

## Screens

| Component | Description |
|-----------|-------------|
| `onboarding.tsx` | First-run ZAI API key setup |
| `sidebar.tsx` | Project/chat navigation |
| `workspace.tsx` | Chat + diff + terminal views |
| `model-selector.tsx` | Searchable model picker |
| `settings.tsx` | 4-tab settings page |

## Running

```bash
pnpm install
pnpm dev
```
