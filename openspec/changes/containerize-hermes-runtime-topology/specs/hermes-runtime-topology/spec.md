## ADDED Requirements

### Requirement: The effective Hermes topology is inventoried before containerization

The platform SHALL inventory host processes, profile gateways, Honcho, PostgreSQL/pgvector, Redis, auxiliary containers, Compose projects, ports, networks, volumes, health checks, restart ownership and secret inputs. Every component MUST be classified as required, optional, external, host-owned or container-owned.

#### Scenario: Two supervisors own the same gateway
- **WHEN** topology validation finds overlapping restart authority
- **THEN** the container plan is blocked and identifies the conflicting owners without exposing configuration secrets

### Requirement: Behavioral equivalence is proven per profile

Each migrated profile MUST pass the same versioned contract on host and candidate container for profile identity, provider and observed model, subscription or token-plan billing mode, session continuity, tool behavior, streaming, cancellation, timeout and recovery. Direct provider reserves MUST NOT be treated as equivalent to Hermes subscription access.

#### Scenario: Flash 0731 candidate uses a direct DeepSeek route
- **WHEN** the approved profile expects Alibaba Token Plan
- **THEN** equivalence fails even if generated text is otherwise valid

#### Scenario: One profile fails equivalence
- **WHEN** other profiles pass
- **THEN** only the failing profile remains host-owned and no implicit default fallback is enabled

### Requirement: The future composition has isolated persistence, networking and secrets

The definitive topology SHALL use private internal networks, service-specific database identities, explicit volumes and secret references. Images and manifests MUST exclude plaintext tokens, cookies, private prompts and host Hermes homes. Internal databases and gateways MUST NOT bind publicly.

#### Scenario: Expanded Compose exposes Redis publicly
- **WHEN** verification detects a wildcard or public host binding
- **THEN** startup fails before any gateway receives credentials

### Requirement: Startup and readiness follow the dependency graph

Startup SHALL gate storage and migrations before memory and auxiliary services, then profile gateways, then consumers. Readiness MUST verify expected capability and billing/provider identity in addition to process liveness, using a non-billable or explicitly bounded probe.

#### Scenario: Gateway process is alive with the wrong profile binding
- **WHEN** readiness compares its observed contract
- **THEN** the gateway remains unready and downstream dispatch stays disabled

### Requirement: Stateful components have compatible backup and rollback

Every persistent Hermes component MUST declare backup, restore, upgrade, downgrade and ownership behavior compatible with the disaster-recovery and retention policies. Live SQLite database, WAL and SHM files MUST NOT be copied independently.

#### Scenario: Container upgrade cannot read existing session state
- **WHEN** compatibility rehearsal fails
- **THEN** migration is blocked and the verified host gateway remains authoritative

### Requirement: Activation remains separately authorized

This specification SHALL authorize inventory, fixtures, contract tests and candidate manifests only. Starting the definitive Hermes composition, moving credentials or switching profile traffic MUST require a separate owner-approved change after behavioral equivalence, recovery rehearsal and independent security review.

#### Scenario: Candidate manifest passes static validation
- **WHEN** activation approval is absent
- **THEN** tooling may render and inspect the plan but refuses to start or switch gateways

