# Design: Spock project control plane

## Architectural decision

Use a modular TypeScript control plane: Next.js/React for UI and APIs, a separate Node.js worker,
shared framework-independent domain modules, PostgreSQL, Drizzle migrations, a transactional job
queue/outbox, Zod boundaries and Server-Sent Events. Keep the existing Python 3.12 FastAPI/LangGraph
`agent-orchestrator` as the workflow execution service and Hermes as the gateway for models, profiles,
credentials and messaging.

Do not rewrite the product in Go or Elixir now. Go remains appropriate for a future remote daemon;
Elixir remains an option if distributed scheduling becomes the dominant problem. The present need is
one reliable domain and accounting model, not another orchestration implementation.

## Topology and ownership

```text
Browser -> Spock Next.js/API -> Spock PostgreSQL
                    |                 ^
                    v                 |
               Node worker -------- outbox
                    |
                    v
       Python agent-orchestrator/LangGraph -> Hermes -> model providers
                    |
                    +-> Phoenix/OpenTelemetry
```

Spock owns projects, OpenSpec bindings, task lifecycle, assignments, acceptance, evidence and
portfolio totals. Agent Orchestrator owns workflow execution, provider routing, correlation, retries
inside its graph and financial runtime gates. Hermes owns profiles, provider credentials and model
invocation. Honcho remains long-term user memory. No service reads another service's private tables.

Spock and Agent Orchestrator use different PostgreSQL databases, users and migration authorities.
Integration uses an authenticated versioned API and idempotent events.

## Current orchestrator reality

The integration baseline records these facts rather than the broader planned architecture:

- the implemented LangGraph contains a Hermes agent node and conditional DeepSeek technical-reserve
  node, plus a model-free smoke graph;
- it does not yet compile the documented feature/bug/infrastructure team graphs;
- no LangGraph PostgreSQL checkpointer is wired into the compiled graphs;
- the PostgreSQL schema currently stores pilot aggregates and reserve grants/costs rather than a
  general project/task/run event model;
- the Hermes adapter does expose correlation, session, usage, tool calls, timeouts and budget errors;
- 20 pilot tasks recorded 90% first-attempt success, with simulated and billed costs separated;
- the operational documentation defines the intended team and human approval boundaries.

Spock therefore exposes capability states `implemented`, `validated_shadow`, `planned` and
`unavailable`. It never renders a planned team workflow as an active runtime capability.

## Integration hold premise

Agent Orchestrator is an externally evolving project and is outside the mutation and deployment
scope of this change. Until the owner explicitly announces its completion and authorizes the next
integration phase:

- Spock MUST NOT change files, schemas, services, profiles or deployment state in Agent Orchestrator;
- Spock MUST NOT call a live Agent Orchestrator endpoint, consume its live events or share its database;
- Spock MUST develop against versioned local fixtures and a `FakeOrchestratorAdapter` only;
- all orchestrator configuration and dispatch feature flags MUST default to disabled;
- the absence of Agent Orchestrator MUST NOT degrade project, OpenSpec, document, agent-catalog,
  assignment, accounting, evidence or analytics functionality;
- contract assumptions learned from the current repository MUST be marked provisional;
- observation-only integration, contract negotiation and live dispatch require separate gates after
  the owner's explicit notification.

This hold does not block PostgreSQL foundations, project/catalog work, OpenSpec synchronization,
stable task identity, team modeling, offline run schemas, usage/cost accounting, evidence, analytics,
authentication or UI development.

## Team catalog and routing

Agents are durable Spock records linked to external Hermes profile bindings and immutable profile
snapshots. Initial engineering roles are:

| Role | Default profile | Responsibility |
|---|---|---|
| supervisor | `spock` | classification, plan approval and final synthesis |
| architect | `la-forge` | solution design and engineering direction |
| implementer | `b-elanna` | backend, APIs, integrations and refactoring |
| debugger | `barclay` | reproduction and localized fixes |
| tester | `rutherford` | tests, CI and automation |
| reviewer | `tuvok` | logic, security and rigorous review |
| data-specialist | `data` | SQL, data analysis and structured documentation |
| operator | `obrien` | Docker, infrastructure and operational execution |

Specialists such as Uhura, Troi, Seven, Bashir and Crusher are registered only for authorized
project classes. A role is stable even if its model changes. Each run stores the exact observed
profile, provider, model, billing mode, instruction/configuration hash and capability snapshot.

Routing is policy-based, not personality-based. Task type, risk, required capabilities, budget,
provider availability, project allowlist and approval policy determine eligible roles. The generic
`default` profile is never an implicit production fallback. Fallbacks must be declared, observable
and financially classified.

## Workflow templates

Versioned templates define nodes, role requirements, transitions, correction limits and approval
gates. Initial templates are:

- feature: Spock -> La Forge -> B'Elanna -> Rutherford -> Tuvok when risk requires -> human;
- bug: Barclay reproduces -> implementer fixes -> Rutherford proves regression -> optional Tuvok -> human;
- infrastructure: O'Brien observes -> La Forge assesses impact/rollback -> Rutherford validates ->
  human approves -> O'Brien executes -> operational evidence verifies;
- analysis/documentation: Data or specialist -> reviewer based on risk -> human acceptance.

Until a template exists as an executable LangGraph, Spock may track its steps manually or in shadow
mode but MUST NOT auto-dispatch the next node. At most two automatic correction loops are allowed by
default; exhaustion becomes a human-visible blocker.

## PostgreSQL model

Create `workspaces`, `users`, `workspace_memberships`, `projects`, `project_sources`, `repositories`,
`documents`, `spec_changes`, `requirements`, `acceptance_scenarios`, `tasks`, `external_bindings`,
`agents`, `agent_profile_versions`, `team_roles`, `workflow_templates`, `workflow_versions`,
`task_assignments`, `workflow_runs`, `runs`, `run_turns`, `run_events`, `run_leases`, `handoffs`,
`usage_events`, `price_catalog_entries`, `cost_entries`, `evidence`, `quality_gates`,
`quality_gate_results`, `domain_events`, `jobs`, `outbox_events`, `sync_runs` and `audit_events`.

Use time-sortable opaque application IDs. External IDs are unique bindings, never primary keys.
Usage, domain and audit events are append-only. Mutable aggregates use optimistic versions.
Migrations are forward-only with recovery guidance and are executed by a deployment-only role.

## OpenSpec source of truth and identity

OpenSpec owns proposal, design, requirements, scenarios, task structure and checkbox state.
PostgreSQL owns durable IDs, bindings, assignments, workflow/run history, usage, cost, evidence and
approvals. A checkbox is observed evidence; a database transition does not silently rewrite Markdown.

Resolve task identity from explicit hierarchical reference, then `.spock/bindings.json`, then a
previously confirmed source anchor. Titles and sections are mutable attributes. Ambiguous tasks enter
`unstable_identity`; missing tasks are tombstoned and history is never auto-rebound.

## Synchronization

A persisted sync job validates containment, captures source revision, uses bounded descriptor-anchored
reads, computes a deterministic reconciliation plan and atomically writes projections, domain events
and outbox messages. Results distinguish created, updated, checked, reopened, missing, conflicted and
unstable. Failure preserves last-known-good data and displays freshness plus sanitized error class.

## Execution contract

Spock submits `request_id`, project/task IDs, workflow version, role/profile binding, objective,
verified workspace reference, budget, approval policy, completion criteria and correlation ID. The
orchestrator returns a durable workflow/run ID and emits sequenced events with an idempotency key.

Normalized events cover workflow/run/turn state, handoff, session, tool calls, usage, approval,
budget block, reserve request, evidence reference, completion and error classification. Unknown
delivery outcome is reconciled before retry; it is never blindly repeated.

Ready work uses transactional claims with renewable leases. Agent cwd is an isolated worktree or
clone below a run root, never the source checkout. Reconciliation compares Spock state, orchestrator
state, lease, provider session, source task and workspace existence. Retries use bounded exponential
backoff with jitter and preserve all attempts.

## Usage, prices and costs

Normalize input, cached-input, cache-write, output, reasoning, tool-call and compute usage. Every
event requires a provider ID or deterministic deduplication key; corrections are compensating events.

Price entries contain provider, pricing model, metric, unit, currency, effective interval, source and
confidence. Cost entries retain their quantity, unit price and price snapshot. Classes are `actual`,
`estimated`, `simulated`, `allocated` and `infrastructure`. Subscription routes may have billed cost
zero while retaining simulated equivalent cost; pay-per-token routes record both independently.

## Time definitions

- lead time: task creation to human acceptance;
- queue time: ready to first run start;
- cycle time: first run start to acceptance;
- run wall time: run start to finish;
- active agent time: active intervals per run;
- blocked time: sum of task blocked intervals;
- review time: first review submission to acceptance;
- project elapsed time: project start to completion;
- agent-hours: sum across agents, including parallel work.

Reports expose missing inputs and confidence. Calendar time and agent-hours remain separate.

## Evidence and gates

Evidence includes commit, diff, PR, test, CI, coverage, document, screenshot, video, deployment,
trace reference and human approval. Agent success closes a run but cannot accept a task. Gate results
store policy version, evidence set and reviewer. Migration, deploy, destructive action, paid reserve,
budget change, secret change, push/merge and release retain explicit human authority unless a later
approved autonomy matrix says otherwise.

## Security and degraded behavior

Application authentication and RBAC are mandatory for mutations; Tailscale is only a network layer.
Paths are operator-registered and revalidated. Secrets are encrypted references, injected only into
the required child and redacted before logs/traces. Hooks are hashed, allowlisted and reapproved when
changed. Web, worker, migration and orchestrator database roles are separate.

When providers fail, the UI serves persisted state with freshness and source status. Database failure
blocks dispatch rather than running unrecorded work. Raw Hermes profiles, secrets, filesystem paths
and private Phoenix payloads never reach the browser.

## Migration and tests

Migrate by persisting discovery, shadow-syncing OpenSpec, comparing old/new projections, importing
stable identities, observing orchestrator events, then enabling authenticated mutations and dispatch.

Test domain transitions, real PostgreSQL concurrency, usage idempotency, OpenSpec reconciliation,
shared orchestrator contract fixtures, worker/orchestrator crash recovery, capability-state accuracy,
path/secret/auth boundaries, team handoffs, price snapshots, metrics and browser workflows. Autonomous
dispatch remains disabled until persistence, identity, authentication, audit and reconciliation pass.
