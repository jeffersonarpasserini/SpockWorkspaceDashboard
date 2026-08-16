## ADDED Requirements

### Requirement: Every runtime data class has a versioned retention rule

The platform SHALL maintain a versioned retention matrix for domain events, runs and turns, sessions, usage and cost facts, audit records, observations and traces, application and container logs, ephemeral worktrees, exports and backups. Every rule MUST identify the authority, classification, retention clock, active period, tombstone behavior, purge deadline, derived copies and permitted holds. Missing or ambiguous rules MUST block deletion.

#### Scenario: Retention planner encounters an unknown class
- **WHEN** a stored object has no exact effective retention rule
- **THEN** the planner reports it as blocked and does not infer a default lifetime

#### Scenario: Cost payload reaches expiry
- **WHEN** detailed provider payload is no longer required but an authorized accounting fact must remain
- **THEN** the payload is removed or minimized while the immutable amount, provenance, correction chain and policy revision remain

### Requirement: Holds and tombstones preserve evidence without preserving payloads indefinitely

Evidence and incident holds MUST be scoped, authorized, justified, time-bounded and audited. A tombstone SHALL retain only opaque identity, data class, policy revision, deletion time and non-sensitive proof needed to prevent resurrection or double counting.

#### Scenario: Expired object is covered by an active hold
- **WHEN** purge evaluates the object
- **THEN** content is preserved, the hold decision is recorded without copying the content and reevaluation is scheduled before or at hold expiry

#### Scenario: Hold expires
- **WHEN** no other valid hold applies
- **THEN** the normal retention transition resumes without requiring an operator to rediscover the object manually

### Requirement: Retention execution is bounded, idempotent and observable

Retention jobs MUST support dry-run plans, bounded batches, atomic claims, resumable cursors and idempotent outcomes. Audit evidence MUST contain rule revision, counts, sanitized failures and confirmation state, but MUST NOT contain deleted payloads, credentials, provider tokens or private prompts.

#### Scenario: Worker fails during a purge batch
- **WHEN** another worker resumes an expired claim
- **THEN** already confirmed objects are not processed twice and unresolved objects remain visible as pending or failed

#### Scenario: Dry-run is requested
- **WHEN** an operator evaluates a new policy revision
- **THEN** the platform reports affected counts and blockers without mutating data or external systems

### Requirement: Derived copies and backups cannot silently resurrect deleted data

Deletion SHALL propagate to owned projections, indexes and exports within the policy deadline. Backup generations MUST declare their retention and outstanding tombstones; restore MUST reconcile tombstones before traffic or writes are enabled.

#### Scenario: Old backup contains a subsequently deleted session
- **WHEN** that backup is restored into isolation
- **THEN** restore applies the authorized tombstone ledger before readiness and proves that the session payload is unavailable

#### Scenario: External deletion cannot be confirmed
- **WHEN** an observation or log adapter is unavailable or lacks deletion support
- **THEN** the request remains degraded and visible rather than being recorded as completed

### Requirement: Ephemeral filesystem deletion is path-contained

Worktree and temporary artifact cleanup MUST operate only below an explicitly configured canonical run root, MUST reject symlinks and path escapes and MUST NOT recursively target a workspace root, home directory or unresolved path.

#### Scenario: Cleanup candidate escapes through a symlink
- **WHEN** canonical resolution leaves the approved run root
- **THEN** cleanup fails closed, records a sanitized security event and removes nothing

### Requirement: Privacy status is accessible and does not expose sensitive content

Authorized operators SHALL be able to inspect policy revision, class-level age, pending holds, purge lag and failures using semantic text and non-color-only states. The browser MUST NOT receive deleted payload samples, secret values or private prompt content.

#### Scenario: Viewer inspects retention health
- **WHEN** the viewer lacks privacy-operator scope
- **THEN** the UI exposes only aggregate non-sensitive health or denies the view according to workspace policy

