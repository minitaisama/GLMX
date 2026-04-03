## 1. Provider Preset
- [ ] 1.1 Add an `OpenRouter` provider preset with the official OpenRouter base URL on the existing OpenAI-compatible path.
- [ ] 1.2 Persist OpenRouter-specific provider config and API key state without breaking current providers.

## 2. Metadata Discovery
- [ ] 2.1 Add a main-process fetcher for official OpenRouter model metadata.
- [ ] 2.2 Cache the fetched metadata with a last-refreshed timestamp and reasonable TTL behavior.
- [ ] 2.3 Add a helper that derives free and coding-capable candidate lists from the fetched metadata.

## 3. App Surfaces
- [ ] 3.1 Add provider settings UI for OpenRouter that includes refresh and quick-apply actions.
- [ ] 3.2 Surface current free coding recommendations in Settings when OpenRouter is active.
- [ ] 3.3 Make the model selector clearly reflect OpenRouter slot mappings, especially when `openrouter/free` is configured.

## 4. Verification
- [ ] 4.1 Run a build or typecheck covering main and renderer changes.
- [ ] 4.2 Manually verify switching to OpenRouter, saving a key, refreshing metadata, applying recommended slots, and starting a coding chat.
- [ ] 4.3 Confirm existing ZAI and other provider flows remain unchanged.
