## ADDED Requirements

### Requirement: OpenSpec remains the source of declared intent

The system MUST treat OpenSpec files as authoritative for proposal, design, requirements, scenarios,
task structure and checkbox state while PostgreSQL owns bindings and operational history.

#### Scenario: Database task state differs from checkbox
- **WHEN** a run marks a task implemented but its OpenSpec checkbox remains unchecked
- **THEN** the system exposes the divergence and does not silently modify either source

### Requirement: Imported entities have stable identity

The system MUST NOT derive durable task identity from mutable title or section text and SHALL prefer
explicit hierarchical references or confirmed repository-local bindings.

#### Scenario: Task title is clarified
- **WHEN** synchronization observes the same stable reference with a changed title
- **THEN** the existing task is updated without losing assignments, runs, evidence or costs

#### Scenario: Two tasks share an ambiguous reference
- **WHEN** synchronization cannot uniquely bind an observed task
- **THEN** it records a conflict and prohibits automatic execution attachment until resolved

### Requirement: Reconciliation is deterministic and non-destructive

Each sync MUST classify observed changes as created, updated, checked, reopened, missing, conflicted
or unstable and MUST tombstone missing entities instead of deleting history.

#### Scenario: Accepted task is removed from tasks.md
- **WHEN** a later source revision no longer contains the task
- **THEN** it is marked missing with its last source revision while prior work remains queryable

### Requirement: OpenSpec reads preserve containment

Synchronization MUST retain bounded descriptor-anchored reads, reject symlink escapes and avoid
exposing absolute roots or raw errors.

#### Scenario: Active change is replaced by a symlink
- **WHEN** synchronization encounters the symlinked change
- **THEN** the source is unavailable, no external content is ingested and the browser receives a sanitized state
