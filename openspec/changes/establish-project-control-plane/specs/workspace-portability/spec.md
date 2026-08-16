## ADDED Requirements

### Requirement: Dashboard and Agent Architecture share a bounded monorepo

The Dashboard and `agent-architecture` source trees SHALL be maintained in one versioned monorepo
with history-preserving imports, pinned toolchains, shared versioned wire contracts and independent
build, test and release targets. Source co-location MUST NOT merge their processes, databases,
migration authorities, secret scopes or source-of-truth ownership.

#### Scenario: Root verification runs after consolidation
- **WHEN** an operator executes the documented root verification command on a clean checkout
- **THEN** both services and shared contracts are built and tested at pinned versions while boundary tests prove that neither service can use the other's database authority

#### Scenario: Monorepo is created while the integration hold is active
- **WHEN** Agent Architecture source is moved beside the Dashboard
- **THEN** no live endpoint is invoked or enabled and Spock continues using fixtures and the fake adapter until a separate authorization lifts the hold

### Requirement: Deployment artifacts are immutable and portable

The monorepo SHALL produce immutable, verified service artifacts and a release manifest that records
source revision, image digests, schema versions, configuration contract and backup compatibility.
One documented operator workflow SHALL support plan, verification, deployment and rollback on both
the current local server and a clean VPS without compiling mutable source on the target server.

#### Scenario: Clean VPS receives a release
- **WHEN** an operator supplies an approved release manifest and environment-specific secret references
- **THEN** the deployment verifies artifact provenance and compatibility before starting independently isolated services

#### Scenario: Target validation fails
- **WHEN** an image digest, required configuration, database boundary or health assertion differs from the manifest
- **THEN** deployment fails before cutover and preserves the previously working release

### Requirement: Hermes process dependencies are discovered and health-gated

Before defining the portable Docker topology, the platform SHALL inventory the effective Hermes
runtime across host processes, profile gateways, auxiliary containers, Compose projects, Honcho,
PostgreSQL/pgvector, Redis, networks, ports, volumes, health checks and restart policies. Every
component MUST be classified as required, optional or externally managed. The deployment manifest
MUST encode an ordered dependency graph and MUST NOT assume that a host-installed Hermes process is
container-equivalent without executable compatibility evidence.

#### Scenario: Deployment plan is generated from the local server
- **WHEN** discovery finds host gateways plus Docker-managed dependencies
- **THEN** the plan reports their ownership and startup order and refuses to omit an unhealthy required dependency

#### Scenario: Agent services start on a clean VPS
- **WHEN** databases and memory services are ready and required Hermes gateways pass profile-level health checks
- **THEN** Agent Architecture may start, while Spock starts independently and reports execution unavailable until the authorized orchestrator path is ready

#### Scenario: Internal dependency has a public binding
- **WHEN** PostgreSQL, Redis, Honcho or an internal agent API would bind to a public interface
- **THEN** verification fails before startup and reports the offending service without exposing its configuration secrets

### Requirement: Workspace exports are complete, versioned and secret-safe

The platform SHALL export a versioned, checksummed bundle describing all durable agent-workspace state
needed for recovery: separate owned database dumps, registered projects and exact Git/OpenSpec
revisions, non-secret deployment configuration, artifact versions and required secret references.
Filesystem content MAY be embedded only by explicit bounded policy. Default exports MUST exclude
plaintext credentials, provider tokens, private prompts, caches, logs, telemetry payloads and ephemeral
run worktrees.

#### Scenario: Operator creates a migration bundle
- **WHEN** every required component is captured and its checksum and compatibility metadata validate
- **THEN** the bundle is published atomically with an inventory that distinguishes included data, externally resolvable sources and secrets requiring reprovisioning

#### Scenario: Secret scanner finds credential material
- **WHEN** export validation detects a plaintext secret or prohibited private prompt content
- **THEN** publication fails, the private staging bundle is retained only according to incident policy and no successful-backup evidence is recorded

#### Scenario: Hermes state is exported while gateways are active
- **WHEN** required profile state uses SQLite with WAL or another live mutable store
- **THEN** export uses a supported consistent backup/checkpoint or bounded quiesce and rejects independent copying of database, WAL and shared-memory files

### Requirement: Restore is proven before server cutover

Restore SHALL target isolated fresh databases and directories and MUST verify checksums, format and
release compatibility, migrations, ownership, record counts, source revisions, secret-reference
availability, readiness and smoke behavior. Export success alone MUST NOT be reported as recoverability;
at least one restore rehearsal SHALL provide evidence before VPS cutover.

#### Scenario: Backup is restored on a fresh server
- **WHEN** the bundle and required external sources are available
- **THEN** restore reconstructs the workspace in isolation and reports every missing or mismatched component without enabling writes or traffic

#### Scenario: Local-to-VPS cutover is approved
- **WHEN** rehearsal passes and an operator establishes a final-sync and write-freeze boundary
- **THEN** the VPS becomes writable only after final verification, split-brain writes are prevented and the former server remains available for an explicit rollback procedure
