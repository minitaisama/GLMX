## ADDED Requirements

### Requirement: OpenRouter Provider Preset
GLMX SHALL provide a dedicated OpenRouter preset for the existing OpenAI-compatible provider flow.

#### Scenario: User wants to configure OpenRouter
- **WHEN** the user opens provider settings
- **THEN** GLMX shows an `OpenRouter` provider option
- **AND** the preset includes the OpenRouter base URL and app-managed API key flow

### Requirement: OpenRouter Model Discovery
GLMX SHALL fetch and expose official OpenRouter model metadata so the app can recommend currently available free coding models without requiring manual model lookup.

#### Scenario: User refreshes OpenRouter models
- **WHEN** the user refreshes OpenRouter metadata
- **THEN** GLMX fetches the official model list
- **AND** caches the result with a visible refresh timestamp

### Requirement: Free Coding Recommendations
GLMX SHALL surface a curated set of OpenRouter models that are currently suitable for free or zero-cost coding trials.

#### Scenario: User wants to try a free coding model
- **WHEN** OpenRouter is the active provider and metadata is available
- **THEN** GLMX shows current free coding recommendations
- **AND** each recommendation is derived from official model metadata rather than hard-coded static IDs alone

### Requirement: Quick Slot Mapping For Trials
GLMX SHALL let users apply a recommended OpenRouter free-model setup to the existing heavy, standard, and fast slots with minimal manual editing.

#### Scenario: User applies a recommended OpenRouter setup
- **WHEN** the user chooses a quick-apply action for OpenRouter
- **THEN** GLMX updates the provider's slot mappings
- **AND** the user can start a coding chat without manually typing model IDs into all slots

### Requirement: Free Router Quick Start
GLMX SHALL support OpenRouter's free router as a low-friction trial path.

#### Scenario: User wants the easiest free setup
- **WHEN** the user selects the free-router quick option
- **THEN** GLMX configures the active OpenRouter slot mapping to use `openrouter/free`
- **AND** the model selector reflects that slot mapping in the UI
