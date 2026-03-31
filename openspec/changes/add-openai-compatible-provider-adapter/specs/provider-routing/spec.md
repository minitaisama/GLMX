## ADDED Requirements
### Requirement: Transport-Aware Provider Routing
The system SHALL persist enough provider metadata to decide whether a configured endpoint must be called as Anthropic-compatible or OpenAI-compatible.

#### Scenario: Save OpenAI-compatible provider transport
- **WHEN** a user saves a provider preset that requires OpenAI-compatible routing
- **THEN** the saved provider config includes transport metadata identifying that routing mode

#### Scenario: Preserve Anthropic-compatible routing
- **WHEN** a user saves a provider preset that uses Anthropic-compatible routing
- **THEN** the saved provider config remains routable through the existing Anthropic-compatible flow

### Requirement: OpenAI-Compatible Provider Adapter
The system SHALL support sending chat requests to OpenAI-compatible provider endpoints without using Anthropic-style request bodies.

#### Scenario: Route 9router through the adapter
- **WHEN** the configured provider is the `9router` preset
- **THEN** the request is sent through the OpenAI-compatible adapter path
- **AND** it does not rely on Anthropic-style request formatting for the upstream call

#### Scenario: Apply preset-specific headers
- **WHEN** the `9router` preset is active
- **THEN** the request includes `Host: 9router.colenboro.xyz`
- **AND** the request includes `User-Agent: curl/7.88.1`

### Requirement: Stream Normalization
The system SHALL normalize OpenAI-compatible streaming responses into the existing UI chunk model used by agent chats.

#### Scenario: Stream assistant text to the UI
- **WHEN** the OpenAI-compatible provider returns streamed assistant output
- **THEN** the renderer receives normalized text chunks in the same shape expected by the current chat UI

#### Scenario: Finish a streamed OpenAI-compatible response
- **WHEN** the OpenAI-compatible stream completes
- **THEN** the assistant message is finalized and persisted through the existing chat persistence flow
