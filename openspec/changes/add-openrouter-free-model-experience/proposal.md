# Change: Add an OpenRouter free-model coding experience

## Why
GLMX already has an OpenAI-compatible provider path, but the current experience is still mostly manual: users have to paste an API key, type model IDs themselves, and keep up with OpenRouter's fast-changing free and trial model lineup on their own.

For coding-focused users, especially users testing without paid credits, this creates too much friction. GLMX should make OpenRouter feel first-class by helping users discover coding-capable free models, apply them quickly, and start a coding chat without manual model hunting.

## What Changes
- Add a first-class `OpenRouter` provider preset on the existing OpenAI-compatible path.
- Fetch and cache OpenRouter model metadata from the official Models API so GLMX can discover free and coding-capable models dynamically.
- Surface an in-app "free coding models" experience that highlights current free or zero-cost models suitable for coding and tool use.
- Add quick actions to apply recommended OpenRouter mappings to the existing `heavy`, `standard`, and `fast` model slots without requiring manual JSON editing.
- Add an `openrouter/free` quick option so users can immediately try whichever current free model OpenRouter routes for the request.
- Show freshness metadata so users understand when the free-model list was last refreshed.

## Impact
- Affected specs:
  - `provider-discovery`
- Affected code:
  - `src/shared/provider-presets.ts`
  - `src/main/lib/zai-config.ts`
  - `src/main/lib/trpc/routers/zai.ts`
  - `src/main/lib/trpc/routers/openai-compatible.ts`
  - `src/main/lib/trpc/routers/codex.ts`
  - `src/renderer/components/dialogs/settings-tabs/agents-models-tab.tsx`
  - `src/renderer/features/agents/components/agent-model-selector.tsx`
  - onboarding or provider setup surfaces that currently only emphasize manual provider config
