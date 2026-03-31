# Change: Add OpenAI-Compatible Provider Adapter

## Why
GLMX currently routes provider configuration into Claude Code via Anthropic-style environment variables only. This works for Anthropic-compatible endpoints, but it does not work for endpoints like `9router` that expect OpenAI-compatible request shapes and headers.

## What Changes
- Add a provider adapter layer that can route configured providers as either Anthropic-compatible or OpenAI-compatible.
- Detect the `9router` preset as an OpenAI-compatible provider and use its required custom headers.
- Preserve the existing Anthropic-compatible flow for ZAI and other Anthropic-style endpoints.
- Expose provider transport metadata in config so the app can persist adapter-specific behavior.

## Impact
- Affected specs: provider-routing
- Affected code:
  - `src/main/lib/zai-config.ts`
  - `src/main/lib/trpc/routers/zai.ts`
  - `src/main/lib/trpc/routers/claude.ts`
  - `src/shared/provider-presets.ts`
  - onboarding/settings provider UI
