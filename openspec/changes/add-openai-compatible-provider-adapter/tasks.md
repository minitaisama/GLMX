## 1. Implementation
- [ ] 1.1 Extend persisted provider config with transport metadata and adapter-specific headers.
- [ ] 1.2 Add provider preset metadata for OpenAI-compatible routing.
- [ ] 1.3 Implement an OpenAI-compatible request adapter in the main-process Claude router.
- [ ] 1.4 Add unit tests for OpenAI-to-UI stream normalization.
- [ ] 1.5 Normalize OpenAI-compatible streaming responses into existing UI message chunks.
- [ ] 1.6 Keep Anthropic-compatible providers on the current path without behavior regression.
- [ ] 1.7 Limit scope to existing provider config surfaces; do not add new provider-management UI in this change.
- [ ] 1.8 Validate the `9router` preset end-to-end against the configured headers and model mapping.
- [ ] 1.9 Verify whether `9router` supports usable `tool_calls`; if not, reduce the first implementation to text-only routing and split tool calling into a follow-up.
