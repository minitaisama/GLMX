## Context
GLMX already supports OpenAI-compatible providers through the Codex transport path and stores provider-specific base URLs, headers, and slot mappings. That means OpenRouter can be added without a net-new protocol layer.

The missing piece is discovery and usability. OpenRouter's free lineup changes frequently, and the useful signal is already available from official OpenRouter surfaces:
- the Models API exposes model metadata including `id`, `name`, `created`, `pricing`, `supported_parameters`, and context length
- OpenRouter also exposes the `openrouter/free` router, which automatically selects from currently available free models based on request capabilities

This suggests a better product approach than scraping announcement posts directly: use official machine-readable model metadata for discovery, and use `openrouter/free` as the lowest-friction trial path.

## Goals / Non-Goals
- Goals:
- Make OpenRouter a first-class preset in the provider settings experience.
- Let users discover free or zero-cost coding-capable models without leaving GLMX.
- Provide one-click or low-friction slot mapping for coding use cases.
- Keep the current heavy/standard/fast model abstraction so the rest of the app changes minimally.
- Prefer official OpenRouter metadata over brittle scraping.

- Non-Goals:
- Build a generic provider marketplace.
- Mirror every OpenRouter ranking, category, or pricing detail in GLMX.
- Guarantee that every surfaced free model supports full agent parity in all cases.
- Implement announcement scraping from social feeds or HTML pages.

## Decisions
- Decision: Add a dedicated `openrouter` provider preset.
  - Why: OpenRouter should not require users to hijack a generic preset or overwrite another provider's base URL.

- Decision: Fetch model metadata through a main-process tRPC endpoint and cache the results locally with a refresh timestamp.
  - Why: Renderer code should not be responsible for network integration details, and cached metadata avoids refetching on every render.

- Decision: Identify "free" models using official metadata, primarily zero pricing and OpenRouter's own free router option.
  - Why: This is stable, machine-readable, and less brittle than announcement parsing.

- Decision: Identify "coding-capable" candidates using a heuristic over official metadata.
  - Why: The Models API exposes `supported_parameters`; filtering for tool support and then ranking with model naming and context hints is enough for a first useful version.

- Decision: Keep slot mapping as the integration contract into the existing chat flow.
  - Why: The rest of GLMX already understands `heavy`, `standard`, and `fast`; replacing that abstraction would increase risk.

- Decision: Offer `openrouter/free` as the safest default quick-start option.
  - Why: It adapts to OpenRouter's current free inventory and reduces user setup burden when model availability changes.

## Proposed Heuristics
### Free model classification
A model is considered free-discoverable when at least one of these is true:
- prompt and completion pricing are both `"0"`
- fixed request pricing is `"0"` and token pricing is `"0"`
- the model ID clearly represents a free variant such as a `:free` suffix

### Coding-friendly classification
A model is considered coding-friendly when:
- it supports text output
- and it supports key agent parameters such as `tools` when available
- and it matches at least one coding-oriented ranking signal such as model naming (`coder`, `code`, `qwen3-coder`, `deepseek`, etc.) or strong context/tooling metadata

The first implementation should keep this heuristic explicit and tweakable in one place.

## UX Shape
### Settings > Models / Providers
- Add an `OpenRouter` provider chip.
- Show saved key state, base URL, and slot mapping like other providers.
- Add a `Refresh models` action.
- Add a `Free for coding now` section populated from cached OpenRouter model metadata.
- Add quick actions:
  - `Use OpenRouter Free Router`
  - `Apply Recommended Free Coding Slots`
  - `Copy model id` or direct fill actions for individual candidate models

### Model selector / new chat
- When OpenRouter is active, show the resolved slot model names more prominently.
- Make it obvious when a slot currently points to `openrouter/free`.
- Keep the rest of the model picker flow unchanged.

## Risks / Trade-offs
- Free model availability changes quickly.
  - Mitigation: cache results briefly, show "last refreshed" time, and provide manual refresh.

- Some free models may be zero-cost but still poor at tool calling or coding.
  - Mitigation: rank candidates conservatively and expose `openrouter/free` as a fallback rather than claiming perfect quality.

- OpenRouter metadata may not explicitly say "best for coding".
  - Mitigation: use a transparent heuristic and keep the recommendation layer lightweight.

- Codex/OpenAI-compatible runtime behavior may differ across free providers.
  - Mitigation: keep provider selection and model recommendation separate from transport; fall back to existing transport behavior.

## Migration Plan
1. Add the `OpenRouter` preset and persisted config defaults.
2. Add a metadata fetcher and cache for official OpenRouter models.
3. Add a ranking helper for free coding candidates.
4. Expose tRPC endpoints for refresh and retrieval.
5. Add the provider UX and quick-apply actions in Settings.
6. Verify chat startup still works through the existing OpenAI-compatible transport path.

## Open Questions
- Whether GLMX should auto-refresh OpenRouter metadata on app launch or only on demand plus TTL-based reads.
- Whether the first recommended slot mapping should use `openrouter/free` for all slots, or use concrete free models for `heavy` and `fast` when high-confidence candidates exist.
