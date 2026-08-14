## ADDED Requirements

### Requirement: Run success does not equal accepted work

An agent or orchestrator success MUST close only the corresponding run and MUST NOT directly accept,
validate or release its task or specification.

#### Scenario: Agent reports completion without tests
- **WHEN** the run succeeds but required validation evidence is absent
- **THEN** the task remains implemented or validating and the missing gate is visible

### Requirement: Evidence is attributable and verifiable

Evidence MUST include type, provenance, related task/run, source revision, creation time and
verification state, with a content hash or authoritative external reference where applicable.

#### Scenario: CI evidence targets an older commit
- **WHEN** the recorded successful check does not match the review revision
- **THEN** the quality gate remains unsatisfied for the current revision

### Requirement: Quality gates are versioned

Required gates SHALL be determined by versioned project policy and task type so evaluation can be
reproduced after policy changes.

#### Scenario: Security policy changes after acceptance
- **WHEN** a historical task is reviewed later
- **THEN** its acceptance shows the policy and evidence set used at that time without retroactively rewriting the decision

### Requirement: Human decisions are explicit

Acceptance, rework and privileged external actions MUST identify the authorized human, scope,
evidence, expiry when applicable and reason.

#### Scenario: Migration is ready to execute
- **WHEN** tests pass but no authorized migration approval exists
- **THEN** the workflow blocks before the migration and presents the exact approval scope and rollback evidence required
