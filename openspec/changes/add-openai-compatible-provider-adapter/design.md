## Context
GLMX uses `@anthropic-ai/claude-code` as its primary runtime. The current provider customization works by setting `ANTHROPIC_*` environment variables and optionally `ANTHROPIC_CUSTOM_HEADERS`. That is sufficient for Anthropic-compatible endpoints, but not for OpenAI-compatible endpoints that require a different request body shape and streaming format.

The requested `9router` endpoint is OpenAI-compatible and also requires fixed `Host` and `User-Agent` headers.

## Goals / Non-Goals
- Goals:
- Add an adapter boundary so provider transport type is explicit.
- Support OpenAI-compatible routing for the `9router` preset.
- Keep existing Anthropic-compatible behavior unchanged for current users.
- Preserve streaming behavior in the chat UI.

- Non-Goals:
- Replace Claude Code SDK entirely for all providers.
- Add a generic provider marketplace or arbitrary protocol plugins.
- Rewrite the renderer chat pipeline.
- Add new provider switcher flows or broader preset management in this change.

## Decisions
- Decision: Introduce provider transport metadata in saved config.
  - Why: The app needs to know whether a configured provider should be sent through Anthropic-style env wiring or an OpenAI-compatible adapter.

- Decision: Keep Anthropic-compatible providers on the current Claude SDK path.
  - Why: This minimizes regression risk for the existing ZAI flow.

- Decision: Add an OpenAI-compatible adapter path in the main-process Claude router.
  - Why: The adapter needs access to persisted chats, streaming emission, cancellation, and existing tool/result transformation logic.

- Decision: Treat the `9router` preset as OpenAI-compatible with fixed headers.
  - Why: This matches the supplied working OpenClaw configuration.

- Decision: Gate full tool-calling support on verified upstream behavior.
  - Why: The main technical uncertainty is whether `9router` returns OpenAI-compatible `tool_calls` consistently enough for parity with the existing Claude path.

## Risks / Trade-offs
- Streaming event formats differ between Anthropic and OpenAI-compatible APIs.
  - Mitigation: Normalize adapter output into the existing UI chunk format before emission.

- Tool calling support may differ from the Claude SDK path.
  - Mitigation: Verify `tool_calls` support first. If the endpoint does not support it reliably, ship text-only routing first and split tool calling into a follow-up change.

- Two execution paths increase maintenance cost.
  - Mitigation: Keep a small adapter surface and share downstream message persistence/emission code where possible.

## Migration Plan
1. Extend provider config with transport metadata.
2. Detect `9router` as OpenAI-compatible.
3. Add main-process adapter branch for OpenAI-compatible requests and streaming.
4. Add stream-normalization tests before integration.
5. Validate that ZAI still routes through the Anthropic-compatible branch.

## Open Questions
- Whether `9router` expects `/chat/completions` or `/completions` as the primary endpoint for the `gpt` model.
- Whether `9router` returns usable `tool_calls` responses for the models intended in GLMX.
