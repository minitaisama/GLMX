## ADDED Requirements

### Requirement: Unified Desktop Navigation Shell
The desktop application SHALL present a single primary navigation shell for chat and workspace navigation instead of exposing multiple competing left-side navigation columns by default.

#### Scenario: User opens the desktop workspace
- **WHEN** the user opens GLMX on desktop
- **THEN** the application shows one primary left navigation shell
- **AND** the shell contains the main navigation actions and thread/workspace navigation
- **AND** the application does not present a second always-visible competing left-side navigation column by default

### Requirement: Contextual Sub-Chat Navigation
The desktop application SHALL preserve sub-chat navigation by presenting it as contextual content within the unified shell rather than as an independent navigation frame.

#### Scenario: User enters a chat with sub-chats
- **WHEN** a user selects a chat that has sub-chats
- **THEN** the unified shell reveals the sub-chat context within the same navigation system
- **AND** the user can switch sub-chats without losing access to the parent chat context

### Requirement: Secondary Feature Panels Remain Reachable
The desktop application SHALL keep details, files, terminal, plan, and diff features reachable after the shell simplification.

#### Scenario: User opens an inspection feature
- **WHEN** the user requests files, terminal, plan, or diff information
- **THEN** GLMX opens the relevant feature panel or surface
- **AND** the feature remains reachable without restoring the previous multi-sidebar shell

### Requirement: Feature-Preserving Empty and Collapsed States
The desktop application SHALL provide clear collapsed and empty states that preserve navigation clarity without hiding key flows.

#### Scenario: No project or no chat is selected
- **WHEN** the user has not selected a project or has not created a chat yet
- **THEN** the unified shell still shows a clear path to create/select a workspace or thread
- **AND** the user is not stranded in an empty multi-panel layout

