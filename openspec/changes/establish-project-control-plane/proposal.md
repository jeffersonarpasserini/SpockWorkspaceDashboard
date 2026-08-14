# Change: Establish the Spock project control plane

## Why

The dashboard currently produces transient snapshots of local projects, Git, OpenSpec and Hermes
Kanban. It cannot preserve task identity after document edits, attribute several attempts or agents,
calculate trustworthy time and token metrics, version prices, prove acceptance, or recover active
work after restart. The adjacent Python `agent-orchestrator` has a validated Hermes adapter, budget
controls and pilot ledger, but its implemented LangGraph is not yet the full multiagent workflow
described by its project plan.

Spock needs a durable control plane that connects version-controlled intent to the real team,
workflows, runs, evidence and costs without duplicating Hermes or LangGraph responsibilities.

## What Changes

- Introduce a PostgreSQL-backed control plane for projects, repositories, source synchronization,
  OpenSpec governance, team assignments, workflows, runs, evidence, usage, cost and audit history.
- Keep workspace files and OpenSpec documents as declared-intent sources while assigning durable
  database identities and recording source revisions, reconciliation outcomes and provenance.
- Add a TypeScript application/worker boundary with Drizzle-managed forward migrations and isolated
  application, worker and migration database responsibilities.
- Add versioned agent, role and profile concepts plus workflow handoffs, quality gates, token/cost
  accounting and time metrics that do not conflate execution success with human acceptance.
- Establish a versioned adapter boundary for Agent Orchestrator, initially implemented only with
  local fixtures and a fake adapter while the independent orchestrator remains under development.
- Evolve the dashboard incrementally through persisted shadow comparisons and feature flags before
  replacing its existing request-time filesystem projections.

## Goals

- Persist projects, repositories, sources and documentation in PostgreSQL.
- Import OpenSpec proposals, designs, requirements, scenarios and tasks while files remain the
  source of declared intent.
- Preserve stable task identities across title, section, order and checkbox changes.
- Model humans, AI agents, versioned profiles, team roles, assignments, runs, turns and handoffs.
- Represent the actual agent team: Spock, La Forge, B'Elanna, Barclay, Rutherford, Tuvok, Data,
  O'Brien and explicitly enabled specialist profiles.
- Integrate the Python LangGraph orchestrator through a versioned, idempotent contract and accurately
  expose which workflow capabilities are implemented, shadow-only or planned.
- Record tokens and calculate billed, estimated and simulated costs from versioned price catalogs.
- Distinguish calendar duration, queue, active-agent, blocked, review and aggregate agent-hours.
- Require evidence and human quality gates before accepted, validated or released states.
- Add durable claims, retries, stall detection and restart reconciliation without duplicate dispatch.
- Preserve local-first operation, degraded modes, path containment and server-side secrets.

## Non-goals

- Reimplement every Multica feature, public SaaS billing, mobile clients or chat-channel suites.
- Replace Hermes as profile/model gateway, Honcho as long-term memory, Phoenix as trace backend or
  LangGraph as workflow engine.
- Pretend that planned multiagent graphs, PostgreSQL checkpoints or dynamic delegation already exist.
- Replace OpenSpec prose with database-authored copies.
- Support every agent CLI or build a distributed scheduler in the first release.
- Infer real charges from simulated prices or equate run success, checked task, CI and release.
- Enable mutations or execution before application authentication and authorization exist.

## Data sources

- PostgreSQL for durable domain records, jobs, events, usage and cost entries.
- Workspace roots, OpenSpec documents and Git repositories.
- Python `agent-orchestrator` API/events and its Hermes/LangGraph execution metadata.
- Hermes profile metadata through documented surfaces, never its private databases.
- Phoenix/OpenTelemetry correlation references, not duplicated raw telemetry.
- Future GitHub/GitLab evidence adapters and versioned model-price sources.

## Impact

- Makes PostgreSQL and forward-only migrations required runtime dependencies.
- Adds a Node worker and persisted projections while preserving the existing UI during migration.
- Adds a versioned integration contract between Spock and `agent-orchestrator`.
- Replaces filesystem/title-derived identities with durable IDs and external bindings.
- Separates the Spock product database from the `agent_orchestrator` database and user even when both
  share one PostgreSQL instance.

## Operational risks

- Duplicate usage or workflow events could inflate totals without idempotency.
- OpenSpec ambiguity could bind execution history to the wrong task.
- Concurrent workers could dispatch the same task without transactional leases.
- Documentation could overstate multiagent autonomy beyond implemented LangGraph behavior.
- Overlapping runs could confuse elapsed time with agent-hours.
- Price changes could rewrite history if catalog snapshots are mutable.
- Hooks, paths, prompts or telemetry could disclose secrets.
- Tailscale reachability alone would not authorize mutations.

## Success criteria

An OpenSpec task is imported with stable identity, routed to an eligible team role, executed through
the orchestrator with normalized events, charged from deduplicated usage and a versioned catalog,
submitted with evidence and accepted by a human. Restarting web, worker or orchestrator does not lose
the task, claim, workflow correlation, retry, blocker, usage, cost, evidence or audit trail.

## Project premise: Agent Orchestrator independence

Spock development SHALL proceed without modifying, deploying, migrating, invoking or depending on
the in-development `agent-orchestrator`. Until the project owner explicitly communicates that Agent
Orchestrator development is complete and authorizes integration work, Spock SHALL use only its own
PostgreSQL database plus local contract fixtures and fake adapters.

The current Agent Orchestrator source and documentation MAY be inspected to shape a provisional
boundary, but they are not a stable integration contract. Their observed behavior MUST NOT become a
runtime dependency, and Spock MUST remain fully usable when Agent Orchestrator is absent.

## Implementation status (2026-08-14)

The PostgreSQL and OpenSpec identity foundations are implemented. Fifteen of the 89 planned tasks are
complete:

- lifecycle vocabulary and architectural decisions are documented;
- PostgreSQL development/test service, Drizzle schema and first forward migration are available;
- durable project/source registration and canonical path containment are implemented;
- persisted and legacy project summaries can be compared in shadow mode;
- the initial import and real-workspace shadow comparison are covered by tests;
- the OpenSpec schema now represents changes, requirements, scenarios, tasks and external bindings;
- hierarchical references and repository-local bindings preserve task identity across edits;
- deterministic task reconciliation classifies updates, checkbox transitions, missing, conflicted
  and unstable observations without deleting history;
- descriptor-anchored snapshots import proposal, design, capability specs, requirements, scenarios
  and tasks under one content-derived source revision;
- transactional PostgreSQL imports preserve durable IDs and the last-known-good projection when a
  bounded read fails;
- the project page exposes read-only Documents, Specs, Requirements, Scenarios and Tasks projections
  with source revision, identity status and missing-record traceability;
- bounded background synchronization limits changes and elapsed budget per run while persisting
  source freshness, partial status and sanitized failure classes;
- live Agent Orchestrator integration remains disabled through `FakeOrchestratorAdapter`.

Current verification evidence: strict OpenSpec validation, TypeScript typecheck, lint, 106 passing
general tests, five passing real-PostgreSQL integration tests and zero production dependency audit
findings. The legacy versioned-deployment harness and the Next.js build still have pre-existing
environment-specific failures and are not counted as acceptance evidence for this change.
