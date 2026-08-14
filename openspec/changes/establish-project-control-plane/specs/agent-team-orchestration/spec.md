## ADDED Requirements

### Requirement: Spock development is independent from Agent Orchestrator completion

Until the project owner explicitly announces that Agent Orchestrator development is complete and
authorizes integration, Spock MUST NOT modify or deploy that project, call its live services, consume
its live events, share its database, or dispatch work through it. Spock SHALL use local versioned
fixtures and fake adapters for all provisional integration behavior.

#### Scenario: Spock foundation development starts while the orchestrator is changing
- **WHEN** developers implement persistence, OpenSpec, agents, accounting, evidence or UI
- **THEN** the work uses only Spock resources and local fakes and requires no Agent Orchestrator availability

#### Scenario: Live orchestrator endpoint is configured before authorization
- **WHEN** the integration hold remains active
- **THEN** live observation and dispatch remain disabled regardless of endpoint reachability

#### Scenario: Project owner announces orchestrator completion
- **WHEN** the owner explicitly authorizes integration work
- **THEN** the team creates a separately reviewed contract-validation gate before enabling observation or dispatch

### Requirement: Team roles are stable and profiles are versioned

The system MUST model team responsibility independently from mutable Hermes profile, provider and
model settings, and every run MUST reference the exact profile snapshot it observed.

#### Scenario: La Forge changes model
- **WHEN** the architect profile is promoted to another validated model
- **THEN** future runs use a new profile version while historical runs retain the prior model and billing metadata

### Requirement: Initial engineering roles are explicit

The system SHALL support supervisor Spock, architect La Forge, implementer B'Elanna, debugger
Barclay, tester Rutherford, reviewer Tuvok, data specialist Data and operator O'Brien as explicit
roles with project-scoped capabilities.

#### Scenario: Infrastructure task is routed
- **WHEN** a task is classified as infrastructure with destructive execution risk
- **THEN** O'Brien may collect read-only evidence but execution waits for the configured human approval and rollback evidence

### Requirement: Runtime capability claims match executable reality

The system MUST classify orchestrator capabilities as implemented, validated shadow, planned or
unavailable and MUST NOT advertise a documented workflow as executable without contract evidence.

#### Scenario: Feature workflow exists only in documentation
- **WHEN** capability discovery finds no executable versioned feature graph
- **THEN** Spock displays the workflow as planned and does not auto-dispatch its downstream nodes

#### Scenario: Current Hermes reserve graph is inspected
- **WHEN** the deployed orchestrator proves the Hermes primary and conditional reserve nodes
- **THEN** only those proven graph capabilities are marked implemented

### Requirement: Workflow templates preserve handoffs

Each workflow version MUST define roles, transitions, correction limit and approval gates, and each
handoff SHALL retain objective, source revision, output summary, evidence and actors.

#### Scenario: Reviewer requests changes twice
- **WHEN** the default two automatic correction cycles are exhausted
- **THEN** the workflow stops automatic delegation and creates an actionable human blocker

### Requirement: Service integration is versioned and idempotent

Spock SHALL communicate with Agent Orchestrator through an authenticated versioned contract with
request IDs, sequenced events and deduplication keys rather than shared private tables.

#### Scenario: Completion event is delivered twice
- **WHEN** the same orchestrator event is retried
- **THEN** Spock acknowledges it without duplicating transitions, usage, evidence or costs

### Requirement: Dispatch and recovery are durable

The system MUST use transactional claims, renewable leases, isolated workspaces, bounded retries and
restart reconciliation before autonomous execution.

#### Scenario: Worker dies after claiming a task
- **WHEN** its lease expires and no live orchestrator run owns the task
- **THEN** reconciliation records the lost attempt and safely makes the task retryable according to policy

#### Scenario: Delivery outcome is unknown
- **WHEN** a submit request times out after it may have reached the orchestrator
- **THEN** Spock reconciles by request ID before issuing another external execution

### Requirement: Fallback is explicit and governed

The system MUST NOT route to a generic profile or paid provider implicitly and SHALL preserve the
orchestrator's financial block, reserve grant and unknown-outcome states.

#### Scenario: Primary provider is unavailable
- **WHEN** no declared approved fallback is eligible
- **THEN** the run fails or blocks explicitly without invoking another provider
