## ADDED Requirements

### Requirement: PostgreSQL duties and databases are isolated

Spock web, worker and migration roles MUST have least-privilege duties, and Spock MUST use a database
and user distinct from Agent Orchestrator, Honcho and other applications even on a shared instance.

#### Scenario: Spock worker credentials are used against orchestrator tables
- **WHEN** the worker attempts to access the Agent Orchestrator database or schema
- **THEN** PostgreSQL denies the operation

### Requirement: Mutations require application authorization

Every mutation, execution command and event stream MUST enforce authenticated workspace/project
scope; network access through loopback or Tailscale MUST NOT substitute for application policy.

#### Scenario: Tailscale peer lacks project role
- **WHEN** it calls an agent-dispatch endpoint
- **THEN** the application denies the action and writes a sanitized audit event

### Requirement: Secrets and hooks are controlled

Secrets MUST be encrypted references injected only into approved child processes, and executable
hooks MUST be versioned, hashed, allowlisted and reapproved after content changes.

#### Scenario: Repository hook changes after approval
- **WHEN** its observed hash no longer matches the approved version
- **THEN** dispatch blocks before execution and requests a new scoped approval

### Requirement: Filesystem execution is contained

Agent cwd MUST be an isolated worktree or clone below the configured run root and MUST NOT be the
source checkout, workspace root or a path escaped through symlinks.

#### Scenario: Prepared workspace resolves outside the run root
- **WHEN** canonical validation detects the escape
- **THEN** the run fails before starting the agent and records a sanitized security event

### Requirement: Operational state survives restart

Claims, workflows, runs, retries, blockers, usage, costs, evidence and audit history MUST be durable,
and startup MUST reconcile rather than assume in-memory state is authoritative.

#### Scenario: All services restart during a blocked workflow
- **WHEN** Spock and Agent Orchestrator return
- **THEN** the blocker and its approval requirement remain visible and no duplicate provider call occurs

### Requirement: Health and readiness are distinct

The platform SHALL keep liveness minimal and SHALL expose protected readiness for PostgreSQL,
worker heartbeat, migrations, queue and configured integrations without leaking secrets.

#### Scenario: Database is unavailable
- **WHEN** the web process remains alive but durable recording is impossible
- **THEN** liveness may remain healthy, readiness fails and all dispatch/mutations fail closed
