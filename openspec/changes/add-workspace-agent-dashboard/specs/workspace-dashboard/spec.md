## ADDED Requirements

### Requirement: Workspace project discovery

The dashboard MUST discover eligible projects only beneath the configured workspace root and MUST NOT expose paths outside that root.

#### Scenario: Eligible project is listed
- **WHEN** a direct workspace child contains a supported project marker
- **THEN** the overview includes that project with a stable identifier and display name

#### Scenario: Traversal is rejected
- **WHEN** a project identifier resolves outside the configured workspace root
- **THEN** the server rejects the request without reading the target path

### Requirement: Evidence-based project summary

The dashboard MUST present Git, OpenSpec and Hermes availability separately and SHALL derive overall status conservatively from observed evidence.

#### Scenario: Active work is visible
- **WHEN** a project has unchecked OpenSpec tasks or running Hermes tasks
- **THEN** the project summary shows the corresponding counts and an in-progress status

#### Scenario: Malformed Hermes evidence is unavailable
- **WHEN** Hermes returns valid JSON without a recognized task collection
- **THEN** the Hermes source is marked unavailable and cannot contribute to local completion

#### Scenario: Missing source does not imply success
- **WHEN** Git, OpenSpec or Hermes cannot be queried
- **THEN** the affected source is marked unavailable and the dashboard does not treat it as passing or complete

#### Scenario: Local completion is fully evidenced
- **WHEN** every OpenSpec task is checked and Git, OpenSpec and Hermes are all available with no pending live task
- **THEN** the project may be labelled complete locally without implying CI or release success

### Requirement: Project Kanban

The dashboard MUST show Hermes task statuses without loss and SHALL augment them with OpenSpec tasks carrying change and section provenance.

#### Scenario: Agent work is running
- **WHEN** Hermes returns a running task assigned to a profile
- **THEN** the running column displays the task, assignee and source as Hermes

#### Scenario: Pending specification work is shown
- **WHEN** an OpenSpec task checkbox is unchecked
- **THEN** the task appears in the todo column with its change and section

#### Scenario: Blocked work remains distinct
- **WHEN** Hermes returns a blocked task
- **THEN** it appears in the blocked column and is not collapsed into generic pending work

### Requirement: Project-scoped Hermes conversation

The dashboard SHALL provide a project-scoped conversation surface through the configured Hermes OpenAI-compatible API server.

#### Scenario: Message succeeds
- **WHEN** a valid message is sent while the Hermes API is configured and available
- **THEN** the dashboard returns the assistant response and scopes the request to the selected project's verified path

#### Scenario: Conversation continues
- **WHEN** the user sends a follow-up message
- **THEN** the request includes at most 20 validated recent user and assistant messages

#### Scenario: Hermes response is oversized
- **WHEN** the Hermes API response exceeds 1 MB
- **THEN** the dashboard rejects it and returns a sanitized unavailable state

#### Scenario: Chat is unavailable
- **WHEN** the Hermes API is not configured or times out
- **THEN** the interface shows a sanitized unavailable state and preserves the user's project view

### Requirement: Secret and command isolation

The dashboard MUST keep credentials server-side and MUST invoke local commands without a shell or client-controlled argument expansion.

#### Scenario: Browser receives project data
- **WHEN** a project or chat route returns a response
- **THEN** the response contains no API token, environment dump or undisclosed absolute root

#### Scenario: Assistant echoes a verified filesystem root
- **WHEN** the Hermes response contains the verified absolute project or workspace root
- **THEN** the chat route replaces it with a non-sensitive marker before returning the response

### Requirement: Refresh and observation time

The dashboard MUST allow explicit refresh and MUST display when project evidence was observed.

#### Scenario: Project changes after refresh
- **WHEN** the user refreshes after local task or Git state changes
- **THEN** the dashboard fetches current evidence and updates the observation timestamp

### Requirement: Accessible responsive interface

The interface SHALL support keyboard navigation, visible focus, semantic headings and responsive use on desktop and mobile.

#### Scenario: Keyboard-only project navigation
- **WHEN** a user navigates project cards and Kanban controls using the keyboard
- **THEN** each interactive element receives visible focus and can be activated without a pointer
