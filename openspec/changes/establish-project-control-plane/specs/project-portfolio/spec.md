## ADDED Requirements

### Requirement: Projects have durable identity and explicit sources

The system MUST persist projects independently from local paths and SHALL bind every filesystem,
repository, OpenSpec, runner or evidence provider through an explicit source record.

#### Scenario: Existing local project is imported
- **WHEN** a discovered project is accepted into the portfolio
- **THEN** it receives a durable opaque ID and its current path is recorded only as a revalidated source binding

#### Scenario: Project directory is renamed
- **WHEN** an operator rebinds the same project to a renamed verified directory
- **THEN** the project, tasks, runs, costs and history retain their existing identities

### Requirement: Documentation is indexed with provenance

The system SHALL index supported project documents with kind, relative path, content hash, source
revision and freshness without making the database copy the authoritative prose.

#### Scenario: Design document changes
- **WHEN** synchronization observes a changed OpenSpec design at a new Git revision
- **THEN** the document projection is updated and the prior observation remains traceable in history

### Requirement: Portfolio status is evidence based

The system MUST distinguish project activity, implementation, validation, acceptance and release and
MUST NOT infer any of them solely from directory, file or checked-checkbox presence.

#### Scenario: Every task checkbox is checked but CI is unavailable
- **WHEN** OpenSpec reports all tasks checked and no authoritative validation evidence is available
- **THEN** the project may report local implementation evidence but not validated or released status

### Requirement: Source failures preserve last-known-good state

The system MUST retain the last successful projection and expose source freshness and sanitized error
class when a source is unavailable.

#### Scenario: OpenSpec cannot be read
- **WHEN** a bounded safe sync fails for the OpenSpec source
- **THEN** prior data remains visible as stale and the failure is not converted to an empty successful source

### Requirement: Portfolio UI is accessible and responsive

The portfolio SHALL provide semantic headings, keyboard operation, visible focus, responsive layouts
and status distinctions that do not rely on color alone.

#### Scenario: User reviews a blocked project by keyboard
- **WHEN** a keyboard-only user navigates from portfolio to project blockers
- **THEN** all controls are reachable, focus is visible and the blocked status has a textual label
