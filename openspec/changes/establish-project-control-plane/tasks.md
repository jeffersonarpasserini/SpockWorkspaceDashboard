## 1. Domain contract and baselines

- [x] 1.1 RED: add executable tests for project, spec, task, assignment, workflow, run, evidence and cost invariants.
- [x] 1.2 Define the lifecycle vocabulary and prohibit collapsing run success, implementation, validation, acceptance and release.
- [x] 1.3 Record the current dashboard projection and current Agent Orchestrator API/schema/capability baseline as fixtures.
- [x] 1.4 Add ADRs for source-of-truth boundaries, stable OpenSpec identity, TypeScript control plane, Python orchestrator integration and separate PostgreSQL databases.
- [x] 1.5 Validate this change with `openspec validate establish-project-control-plane --strict`.

## 2. PostgreSQL foundation

- [x] 2.1 RED: add integration tests proving application, worker and migration roles have only their required privileges.
- [x] 2.2 Add PostgreSQL development/test services, health checks and non-secret environment schema.
- [x] 2.3 Add Drizzle and forward-only migrations for workspace, project, source, document and sync records.
- [x] 2.4 Add append-only domain/audit events, transactional jobs and outbox tables with retention policy.
- [x] 2.5 Add migration locking, schema-version readiness and backup/restore rehearsal without accessing the Agent Orchestrator or Honcho databases.
- [x] 2.6 Prove concurrent job claims with real PostgreSQL transactions and `SKIP LOCKED` or an equivalent atomic lease.

## 3. Persisted project catalog — vertical slice

- [x] 3.1 RED: test import of currently discovered projects without using filesystem paths as identity.
- [x] 3.2 Implement project, repository and source registration with canonical path containment.
- [x] 3.3 Implement bounded background sync and persist source freshness, revision and sanitized failures.
- [x] 3.4 Run old and persisted project summaries in shadow comparison and surface mismatches.
- [x] 3.5 Switch overview/detail reads behind a feature flag only after parity fixtures pass.
- [x] 3.6 Add project and system health metrics for sync duration, lag and failures.

## 4. OpenSpec governance — vertical slice

- [x] 4.1 RED: add golden fixtures for proposal/design/spec/tasks import, rename, reorder, reopen, removal, duplicate reference and ambiguous identity.
- [x] 4.2 Add schema for spec changes, requirements, scenarios, tasks and external bindings.
- [x] 4.3 Implement hierarchical-reference and `.spock/bindings.json` identity resolution without title-derived durable IDs.
- [x] 4.4 Implement deterministic reconciliation with created, updated, checked, reopened, missing, conflicted and unstable results.
- [x] 4.5 Preserve last-known-good projections when any bounded, descriptor-anchored source read fails.
- [x] 4.6 Implement Specs, Requirements, Scenarios, Tasks and Documents views with source revision and traceability.
- [x] 4.7 Keep OpenSpec mutation disabled until an atomic revision-checked patch and strict-validation slice is separately approved.

## 4A. Monorepo, portable deployment and workspace migration

- [ ] 4.8 Inventory Dashboard and `agent-architecture` repositories, histories, build tools, runtime boundaries, databases, configuration and secret inputs; correlate Hermes host processes, profile gateways, auxiliary containers, Compose projects, Honcho, PostgreSQL/pgvector, Redis, networks, ports, volumes, health checks and restart policies before moving files.
- [ ] 4.9 RED: add contract tests proving a monorepo build cannot collapse service database users, migration authorities, secret scopes or the Agent Orchestrator integration hold.
- [ ] 4.10 Create the monorepo layout with history-preserving imports, pinned toolchains, one lockfile where compatible, shared contract packages and independent service build/test targets.
- [ ] 4.11 Add immutable multi-service release manifests and a plan/verify/deploy/rollback entrypoint usable on the local server and a clean VPS without building source on the target; derive and verify the required/optional/external Hermes dependency DAG and ordered startup/readiness gates.
- [ ] 4.12 RED: test workspace export completeness, checksum failure, incompatible schema/release versions, missing source revisions and exclusion of plaintext secrets/private prompts.
- [ ] 4.13 Implement versioned workspace export with separate database dumps, Git/OpenSpec revision inventory, non-secret configuration, artifact digests, secret-reference inventory, consistent Hermes state backup and optional bounded source embedding; prohibit independent copying of live SQLite/WAL/SHM files.
- [ ] 4.14 Implement restore into isolated databases/directories with checksum, migration, ownership, row-count, source-revision, secret-reference, readiness and smoke verification before cutover.
- [ ] 4.15 Rehearse local-to-fresh-server migration, final-sync/write freeze, explicit cutover and rollback; retain sanitized evidence and document VPS prerequisites, DNS/TLS/Tailscale and recovery steps.

## 5. Team and agent catalog — vertical slice

- [x] 5.1 RED: test stable roles independently of mutable profile/model bindings.
- [x] 5.2 Add agents, immutable profile versions, team roles, project scopes and assignment intervals.
- [x] 5.3 Import the current approved profiles and roles without copying credentials or private prompt content.
- [x] 5.4 Register Spock, La Forge, B'Elanna, Barclay, Rutherford, Tuvok, Data and O'Brien as the initial engineering team.
- [x] 5.5 Expose specialist profiles only through explicit project/task policies; prohibit implicit `default` fallback.
- [x] 5.6 Add agent views for capability, current model binding and explicitly unavailable assignments, outcomes, tokens, costs and evidence until observed run integration exists.

## 6. Agent Orchestrator contract — observation slice

- [x] 6.0 Keep this section limited to local contract fixtures and `FakeOrchestratorAdapter` until the owner explicitly announces Agent Orchestrator completion and authorizes live integration.
- [x] 6.1 RED: add consumer-driven contract fixtures for health, workflow submission, status, sequenced events and idempotency.
- [ ] 6.2 Version the contract and authenticate service-to-service requests without sharing database users.
- [x] 6.3 Add fixture-backed capability discovery with `implemented`, `validated_shadow`, `planned` and `unavailable` states.
- [x] 6.4 Report the current Hermes/reserve graph as implemented and documented team graphs as planned until executable proof exists.
- [x] 6.5 Implement fixture-backed ingestion of session, correlation, profile, observed model, billing mode, usage, tool-call, budget and terminal events.
- [x] 6.6 Reconcile duplicate, missing, out-of-order and unknown-outcome events without double counting.
- [x] 6.7 Keep all live HTTP, event and Phoenix/OpenTelemetry integrations disabled by default while the integration hold is active.
- [ ] 6.8 After explicit owner authorization, create a separate reviewed gate to replace fixtures with observation-only live traffic.

## 7. Workflow and handoff model — vertical slice

- [x] 7.1 RED: test feature, bug, infrastructure and analysis workflow definitions and risk-dependent branches.
- [x] 7.2 Add immutable workflow templates/versions, manual workflow nodes, role steps and handoffs.
- [x] 7.3 Implement manual/shadow execution state for planned nodes without automatic downstream dispatch.
- [x] 7.4 Implement at most two default correction loops, then create an actionable human blocker.
- [x] 7.5 Preserve objective, inputs, output summary, evidence, source revision and actor at every handoff.
- [x] 7.6 Add workflow visualization that clearly distinguishes planned, waiting, running, blocked and completed nodes.

## 8. Runs and durable orchestration — vertical slice

- [ ] 8.0 Do not begin live dispatch tasks while the Agent Orchestrator integration hold remains active.
- [ ] 8.1 RED: prove two workers cannot dispatch the same ready task and expired leases can be safely recovered.
- [ ] 8.2 Add runs, turns, normalized events, leases, attempts, retry schedule and error classification.
- [ ] 8.3 Create isolated worktrees/clones below a dedicated run root and reject source-checkout or symlink escape cwd.
- [ ] 8.4 Implement bounded retry/backoff/jitter, stall detection, cancellation and dead-letter behavior.
- [ ] 8.5 Implement restart reconciliation across Spock, Agent Orchestrator, Hermes session and workspace state.
- [ ] 8.6 After the owner lifts the hold, enable one authenticated Hermes workflow only after contract, observation, audit and reconciliation gates pass.
- [ ] 8.7 Add an operational Runs view with queue, worker, agent, last activity, retry, blockers and cancellation.

## 9. Token and cost ledger — vertical slice

- [x] 9.1 RED: property-test idempotent usage ingestion, compensating corrections and aggregation boundaries.
- [x] 9.2 Add usage events for input, cached input, cache write, output, reasoning, tool calls and compute.
- [x] 9.3 Add immutable effective-dated price catalog entries with source, currency and confidence.
- [x] 9.4 Add cost entries that distinguish actual, estimated, simulated, allocated and infrastructure classes.
- [x] 9.5 Import the pilot's simulated/billed split through a traceable compatibility adapter rather than treating aggregates as raw events.
- [x] 9.6 Add task, run, agent, project and system totals without mixing incompatible cost classes.
- [x] 9.7 Add budget alerts and fail closed when a paid route lacks authoritative remaining-budget evidence.

## 10. Time and performance analytics — vertical slice

- [ ] 10.1 RED: test lead, queue, cycle, wall, active-agent, blocked, review, elapsed and agent-hours definitions including overlapping runs.
- [ ] 10.2 Derive intervals from append-only transitions with provenance and confidence.
- [ ] 10.3 Add portfolio/project/agent reports for throughput, first-attempt success, retries, rework and cost per accepted task.
- [ ] 10.4 Display calendar elapsed time separately from summed parallel agent-hours.
- [ ] 10.5 Mark unavailable or partial metrics instead of substituting current time or zero.

## 11. Evidence and quality gates — vertical slice

- [ ] 11.1 RED: prove successful agent output cannot directly accept a task.
- [ ] 11.2 Add evidence and versioned quality-gate records for commits, diffs, PRs, tests, CI, documents, media, deployment, traces and human approval.
- [ ] 11.3 Implement task-type policies and reproducible gate evaluation over exact evidence revisions.
- [ ] 11.4 Add human accept/rework flows with reviewer, reason and evidence set.
- [ ] 11.5 Add optional GitHub/GitLab evidence adapters without claiming CI or release when unavailable.

## 12. Authentication, authorization and secrets

- [ ] 12.1 RED: prove every mutation, stream and execution action enforces authenticated workspace/project scope.
- [ ] 12.2 Implement owner, admin, operator, reviewer and viewer roles plus agent-specific action scopes.
- [ ] 12.3 Add CSRF protection, optimistic versions, idempotency keys and signed provider webhooks.
- [ ] 12.4 Store encrypted secret references, inject them only into approved children and verify redaction in logs, errors and traces.
- [ ] 12.5 Version/hash hooks and require explicit approval on first use or content change.
- [ ] 12.6 Audit mutations, dispatch, approvals, budget/policy changes and secret-reference changes.

## 13. UI and accessibility

- [ ] 13.1 Add portfolio metrics, budgets, active work, blockers and stale-source indicators.
- [ ] 13.2 Add project tabs for Overview, Specs, Tasks, Runs, Agents, Documents, Costs, Timeline and Settings.
- [ ] 13.3 Add task detail traceability from OpenSpec intent through assignments, runs, usage, evidence and acceptance.
- [ ] 13.4 Add live SSE updates with cursor recovery and authorized filtering.
- [ ] 13.5 Verify keyboard access, focus, semantic status, responsive tables/boards and non-color-only distinctions.

## 14. Migration, operations and rollout

- [ ] 14.1 Rehearse migration from a current-dashboard fixture and verify no history is invented.
- [ ] 14.2 Add liveness, readiness, worker heartbeat, queue lag, reconciliation and dead-letter metrics.
- [x] 14.3 Add PostgreSQL backup/restore, migration and incident runbooks with exact database-role boundaries.
- [ ] 14.4 Run unit, component, contract, PostgreSQL integration, concurrency, security, browser and crash-recovery suites.
- [x] 14.5 Run typecheck, lint, production build and strict validation on every capability spec in this change.
- [ ] 14.6 Complete a shadow run, one supervised real task and a restart drill before enabling autonomous dispatch.
- [ ] 14.7 Obtain independent review of domain semantics, accounting, orchestrator capability claims and security boundaries.
- [ ] 14.8 Archive the old request-time aggregation path only after persisted parity and rollback evidence are approved.
