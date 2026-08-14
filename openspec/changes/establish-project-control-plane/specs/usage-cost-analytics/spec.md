## ADDED Requirements

### Requirement: Usage events are append-only and idempotent

The system MUST record normalized usage with a provider event ID or deterministic deduplication key,
and corrections MUST be compensating events rather than destructive updates.

#### Scenario: Provider retries a token event
- **WHEN** an identical usage event is received again
- **THEN** totals remain unchanged and the duplicate is auditable

### Requirement: Price catalogs are immutable and effective dated

Every price entry MUST identify provider, pricing model, metric, unit, currency, validity interval,
source and confidence, and historical cost entries MUST retain the snapshot used.

#### Scenario: Model price changes
- **WHEN** an authorized operator adds a new effective price
- **THEN** new usage uses the new entry while historical costs remain reproducible with the old entry

### Requirement: Cost classes remain distinct

The system MUST distinguish actual, estimated, simulated, allocated and infrastructure costs and
MUST NOT combine incompatible classes without an explicit report definition.

#### Scenario: Subscription-backed model completes a run
- **WHEN** provider billing reports no marginal charge but usage has an equivalent market price
- **THEN** billed cost may be zero and simulated cost remains visible as a separate value

### Requirement: Time metrics have fixed definitions

The system SHALL calculate lead, queue, cycle, run wall, active-agent, blocked, review, project
elapsed and agent-hours from persisted transitions and SHALL expose provenance and completeness.

#### Scenario: Two agents work concurrently for one hour
- **WHEN** their active intervals fully overlap
- **THEN** elapsed calendar time reports one hour and aggregate agent-hours report two hours

#### Scenario: Acceptance timestamp is missing
- **WHEN** a task has not been accepted
- **THEN** acceptance-dependent metrics are unavailable or partial rather than calculated with the current time as a completed value

### Requirement: Analytics preserve attribution

Portfolio, project, task and agent reports SHALL trace each aggregate to runs, usage, price snapshots,
time intervals and evidence.

#### Scenario: User opens project cost total
- **WHEN** the total contains estimated and simulated entries
- **THEN** the UI separates the classes and allows drill-down to their source runs and catalog snapshots
