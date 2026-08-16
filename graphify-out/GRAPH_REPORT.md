# Graph Report - SpockWorkspaceDashboard  (2026-08-16)

## Corpus Check
- 193 files · ~75,939 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1251 nodes · 1738 edges · 112 communities (97 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `04c51db4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types.ts
- domain.ts
- snapshot.ts
- chat/route.ts
- deploy.sh
- invariants.ts
- compilerOptions
- schema.ts
- background-sync.ts
- Spock Workspace Dashboard
- ADDED Requirements
- ADDED Requirements
- catalog-repository.ts
- ADDED Requirements
- Design: Spock project control plane
- ADDED Requirements
- [id]/page.tsx
- devDependencies
- Decisions
- ADDED Requirements
- establish-project-control-plane/tasks.md
- connection.ts
- add-workspace-agent-dashboard/tasks.md
- ADDED Requirements
- dependencies
- ADDED Requirements
- ADDED Requirements
- Change: Establish the Spock project control plane
- scripts
- verify-compose-config.py
- verify-container-inspect.py
- sync-health.ts
- openspec-explore/SKILL.md
- Decisions
- ADDED Requirements
- What Changes
- metrics.ts
- add-tailscale-dashboard-access/design.md
- Requirement: Publicação Tailscale explícita e restrita
- Design: Workspace Agent Dashboard
- ADDED Requirements
- plan-repository.ts
- Change: Add workspace agent dashboard
- container-verifiers.test.ts
- versioned-deployment.test.ts
- contract.ts
- 0007_runtime_retention_governance.sql
- PostgreSQL operations
- package.json
- ADR 0001: TypeScript control plane with a separate worker
- ADR 0003: Stable OpenSpec task identity
- ADR 0004: Agent Orchestrator integration hold
- add-tailscale-dashboard-access/tasks.md
- add-versioned-deployment-export/tasks.md
- prepare-containerized-local-deployment/tasks.md
- 0006_agent_catalog.sql
- add-tailscale-dashboard-access/proposal.md
- add-versioned-deployment-export/proposal.md
- compose-safe.sh
- dashboard.ts
- ADR 0002: Source-of-truth boundaries
- health/route.ts
- layout.tsx
- database/README.md
- eslint.config.mjs
- jsdom
- next.config.ts
- next-env.d.ts
- @types/react-dom
- typescript
- kanban.ts
- workspace-startup-gate.sh
- ADDED Requirements
- ADDED Requirements
- ADDED Requirements
- containerize-hermes-runtime-topology/design.md
- govern-runtime-data-retention-and-privacy/design.md
- rehearse-disaster-recovery-and-vps-cutover/design.md
- containerize-hermes-runtime-topology/proposal.md
- govern-runtime-data-retention-and-privacy/proposal.md
- rehearse-disaster-recovery-and-vps-cutover/proposal.md
- openspec.ts
- containerize-hermes-runtime-topology/tasks.md
- govern-runtime-data-retention-and-privacy/tasks.md
- rehearse-disaster-recovery-and-vps-cutover/tasks.md
- readiness.ts
- JobQueueRepository
- worktree-cleanup.ts
- repository-postgres.integration.test.ts
- graphify-evidence.md
- workspace.ts
- ledger.ts
- eslint-config-next
- databaseSchema

## God Nodes (most connected - your core abstractions)
1. `die()` - 20 edges
2. `Design: Spock project control plane` - 18 edges
3. `compilerOptions` - 16 edges
4. `main()` - 15 edges
5. `createDefaultDashboardService()` - 15 edges
6. `databaseSchema` - 14 edges
7. `scripts` - 12 edges
8. `createDatabaseConnection()` - 12 edges
9. `readOpenSpecChangeSnapshot()` - 12 edges
10. `FakeOrchestratorAdapter` - 12 edges

## Surprising Connections (you probably didn't know these)
- `createDefaultDashboardService()` --indirect_call--> `readHermesEvidence()`  [INFERRED]
  src/lib/dashboard.ts → src/lib/kanban.ts
- `createDefaultDashboardService()` --indirect_call--> `readOpenSpecEvidence()`  [INFERRED]
  src/lib/dashboard.ts → src/lib/openspec.ts
- `createDefaultDashboardService()` --indirect_call--> `resolveProjectPath()`  [INFERRED]
  src/lib/dashboard.ts → src/lib/workspace.ts
- `POST()` --calls--> `readDashboardConfig()`  [EXTRACTED]
  src/app/api/chat/route.ts → src/lib/config.ts
- `POST()` --calls--> `createDefaultDashboardService()`  [EXTRACTED]
  src/app/api/chat/route.ts → src/lib/dashboard.ts

## Import Cycles
- None detected.

## Communities (112 total, 15 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.13
Nodes (16): columnLabels, KanbanBoard(), tasks, labels, ProjectCard(), project, summarize(), deriveProjectStatus() (+8 more)

### Community 1 - "domain.ts"
Cohesion: 0.06
Nodes (40): labels, WorkflowVisualization(), AgentProfileSnapshot, INITIAL_ENGINEERING_TEAM, ORCHESTRATOR_CAPABILITY_STATES, Project, Run, RUN_STATUSES (+32 more)

### Community 2 - "snapshot.ts"
Cohesion: 0.09
Nodes (33): changed(), duplicates(), ObservedSpecTask, parseRepositoryBindings(), parseSpecTasks(), PersistedSpecTask, reconcileSpecTasks(), ReconciliationEntry (+25 more)

### Community 3 - "chat/route.ts"
Cohesion: 0.17
Nodes (8): chatMessageSchema, POST(), requestSchema, ChatClientOptions, ChatMessage, createHermesChatClient(), Fetcher, readBoundedBody()

### Community 4 - "deploy.sh"
Cohesion: 0.18
Nodes (29): compose(), compose_existing_no_secret(), compose_no_secret(), compose_up_no_start(), container_id(), die(), HERMES_API_KEY, log() (+21 more)

### Community 5 - "invariants.ts"
Cohesion: 0.12
Nodes (23): AgentsPage(), AgentRoutingPolicy, APPROVED_AGENT_PROFILES, ApprovedAgentProfile, assertProfileVersion(), assertStableRoleBinding(), ProfileVersionInput, resolveApprovedAgent() (+15 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 7 - "schema.ts"
Cohesion: 0.10
Nodes (19): agentProfileVersions, agentProjectScopes, agents, auditEvents, domainEvents, jobs, outboxEvents, projects (+11 more)

### Community 8 - "background-sync.ts"
Cohesion: 0.12
Nodes (13): boundedInteger(), OpenSpecBackgroundSync, OpenSpecBackgroundSyncResult, OpenSpecSourceRegistration, PostgresOpenSpecSourceRegistration, ActiveChangeCatalog, listActiveOpenSpecChanges(), openDirectory() (+5 more)

### Community 9 - "Spock Workspace Dashboard"
Cohesion: 0.08
Nodes (23): Acesso Tailscale-only, Configuração e segredos, Estado, verificação e teardown, Execução Docker local, Graphify, Limites, Um comando executável, nunca um helper sourced, Baixar, verificar e implantar (+15 more)

### Community 10 - "ADDED Requirements"
Cohesion: 0.08
Nodes (25): ADDED Requirements, Requirement: Accessible responsive interface, Requirement: Evidence-based project summary, Requirement: Project Kanban, Requirement: Project-scoped Hermes conversation, Requirement: Refresh and observation time, Requirement: Secret and command isolation, Requirement: Workspace project discovery (+17 more)

### Community 11 - "ADDED Requirements"
Cohesion: 0.08
Nodes (24): ADDED Requirements, Purpose, Requirement: Healthcheck mínimo e limitado, Requirement: Imagem de produção restrita, Requirement: Interface preservada no contêiner, Requirement: Recursos e logs são limitados no Compose local, Requirement: Rede local por padrão, Requirement: Verificação e rollback operacionais reproduzíveis (+16 more)

### Community 12 - "catalog-repository.ts"
Cohesion: 0.16
Nodes (13): ProjectIdentity, PersistedProject, ProjectCatalogStore, projectSlug(), WorkspaceRegistration, createPersistedProjectDiscovery(), CatalogMismatch, compareCatalog() (+5 more)

### Community 13 - "ADDED Requirements"
Cohesion: 0.09
Nodes (21): ADDED Requirements, Requirement: Dispatch and recovery are durable, Requirement: Fallback is explicit and governed, Requirement: Initial engineering roles are explicit, Requirement: Runtime capability claims match executable reality, Requirement: Service integration is versioned and idempotent, Requirement: Spock development is independent from Agent Orchestrator completion, Requirement: Team roles are stable and profiles are versioned (+13 more)

### Community 14 - "Design: Spock project control plane"
Cohesion: 0.11
Nodes (18): Architectural decision, Current orchestrator reality, Design: Spock project control plane, Evidence and gates, Execution contract, Integration hold premise, Migration and tests, Monorepo and portable deployment (+10 more)

### Community 15 - "ADDED Requirements"
Cohesion: 0.11
Nodes (18): ADDED Requirements, Requirement: Dashboard and Agent Architecture share a bounded monorepo, Requirement: Deployment artifacts are immutable and portable, Requirement: Hermes process dependencies are discovered and health-gated, Requirement: Restore is proven before server cutover, Requirement: Workspace exports are complete, versioned and secret-safe, Scenario: Agent services start on a clean VPS, Scenario: Backup is restored on a fresh server (+10 more)

### Community 16 - "[id]/page.tsx"
Cohesion: 0.16
Nodes (9): dynamic, ProjectPage(), ChatPanel(), Fetcher, Message, OpenSpecTraceability(), RefreshButton(), loadOpenSpecTraceability() (+1 more)

### Community 17 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, devDependencies, eslint, @playwright/test, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node (+9 more)

### Community 18 - "Decisions"
Cohesion: 0.12
Nodes (16): 1. Imagem multi-stage com saída standalone, 2. Binding interno versus publicação no host, 3. Mount mínimo e somente leitura, 4. Segredos e integrações opcionais, 5. Liveness deliberadamente raso, 6. Validação sem workflow de CI adicional, 7. Runbook verificável e inspeção de segredos, 8. Limites de recursos e logs para Compose não-Swarm (+8 more)

### Community 19 - "ADDED Requirements"
Cohesion: 0.12
Nodes (15): ADDED Requirements, Requirement: Deploy é pull-only e sucesso é comprovado, Requirement: Manifest e proveniência falham fechados, Requirement: Operação é terminal-safe e target é fixo, Requirement: Release usa aprovação, ancestralidade e versão estável, Requirement: Supply chain é fixada e atestada, Requirement: Versão é build-once e não sobrescrevível, Requirement: Workspace e integrações externas permanecem limitados (+7 more)

### Community 20 - "establish-project-control-plane/tasks.md"
Cohesion: 0.12
Nodes (15): 10. Time and performance analytics — vertical slice, 11. Evidence and quality gates — vertical slice, 12. Authentication, authorization and secrets, 13. UI and accessibility, 14. Migration, operations and rollout, 1. Domain contract and baselines, 2. PostgreSQL foundation, 3. Persisted project catalog — vertical slice (+7 more)

### Community 21 - "connection.ts"
Cohesion: 0.24
Nodes (7): DatabaseConfig, databaseEnvironment, readDatabaseConfig(), createDatabaseConnection(), DatabaseConnection, integration, integration

### Community 22 - "add-workspace-agent-dashboard/tasks.md"
Cohesion: 0.14
Nodes (13): 10. Normative status alignment, 11. Hermes evidence shape validation, 12. Unsafe-entry and early-cancellation handling, 13. Status vocabulary cleanup, 1. Foundation, 2. Workspace overview — TDD slice, 3. Project Kanban — TDD slice, 4. Hermes conversation — TDD slice (+5 more)

### Community 23 - "ADDED Requirements"
Cohesion: 0.14
Nodes (13): ADDED Requirements, Requirement: Filesystem execution is contained, Requirement: Health and readiness are distinct, Requirement: Mutations require application authorization, Requirement: Operational state survives restart, Requirement: PostgreSQL duties and databases are isolated, Requirement: Secrets and hooks are controlled, Scenario: All services restart during a blocked workflow (+5 more)

### Community 24 - "dependencies"
Cohesion: 0.15
Nodes (13): drizzle-orm, next, dependencies, drizzle-orm, next, postgres, react, react-dom (+5 more)

### Community 25 - "ADDED Requirements"
Cohesion: 0.15
Nodes (12): ADDED Requirements, Requirement: Documentation is indexed with provenance, Requirement: Portfolio status is evidence based, Requirement: Portfolio UI is accessible and responsive, Requirement: Projects have durable identity and explicit sources, Requirement: Source failures preserve last-known-good state, Scenario: Design document changes, Scenario: Every task checkbox is checked but CI is unavailable (+4 more)

### Community 26 - "ADDED Requirements"
Cohesion: 0.15
Nodes (12): ADDED Requirements, Requirement: Analytics preserve attribution, Requirement: Cost classes remain distinct, Requirement: Price catalogs are immutable and effective dated, Requirement: Time metrics have fixed definitions, Requirement: Usage events are append-only and idempotent, Scenario: Acceptance timestamp is missing, Scenario: Model price changes (+4 more)

### Community 27 - "Change: Establish the Spock project control plane"
Cohesion: 0.17
Nodes (11): Change: Establish the Spock project control plane, Data sources, Goals, Impact, Implementation status (2026-08-14), Non-goals, Operational risks, Project premise: Agent Orchestrator independence (+3 more)

### Community 28 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, db:migrate, dev, lint, prepare:standalone, start, start:standalone (+4 more)

### Community 29 - "verify-compose-config.py"
Cohesion: 0.42
Nodes (11): empty_collection(), main(), Exception, Raised when rendered Compose configuration violates an invariant., require(), require_bind_address(), require_bytes(), require_cpus() (+3 more)

### Community 30 - "verify-container-inspect.py"
Cohesion: 0.42
Nodes (11): main(), Exception, Raised when effective container state violates an invariant., require(), require_bind_address(), require_bytes(), require_cpus(), require_int() (+3 more)

### Community 31 - "sync-health.ts"
Cohesion: 0.23
Nodes (8): average(), calculateSyncHealth(), completedDurations(), ProjectSyncHealth, ProjectSyncHealthRepository, SyncHealthRun, SyncHealthSource, SystemSyncHealth

### Community 32 - "openspec-explore/SKILL.md"
Cohesion: 0.18
Nodes (10): Check for context, Ending Discovery, Guardrails, Handling Different Entry Points, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do (+2 more)

### Community 33 - "Decisions"
Cohesion: 0.18
Nodes (10): Build once por versão, Context, Decisions, Deploy verificado, Gates externos e fail-closed, Goals / Non-Goals, Robustez operacional, Rollback (+2 more)

### Community 34 - "ADDED Requirements"
Cohesion: 0.18
Nodes (10): ADDED Requirements, Requirement: Imported entities have stable identity, Requirement: OpenSpec reads preserve containment, Requirement: OpenSpec remains the source of declared intent, Requirement: Reconciliation is deterministic and non-destructive, Scenario: Accepted task is removed from tasks.md, Scenario: Active change is replaced by a symlink, Scenario: Database task state differs from checkbox (+2 more)

### Community 35 - "What Changes"
Cohesion: 0.18
Nodes (10): Affected data sources, Capabilities, Goals, Impact, Modified Capabilities, New Capabilities, Non-goals, Operational risks (+2 more)

### Community 36 - "metrics.ts"
Cohesion: 0.31
Nodes (8): calculateDevelopmentMetrics(), DevelopmentMetrics, duration(), sumIntervalDurations(), TaskMilestones, TimeInterval, unionIntervalDuration(), validateInterval()

### Community 37 - "add-tailscale-dashboard-access/design.md"
Cohesion: 0.20
Nodes (9): 1. Override explícito e restrito, 2. Verificação declarativa e efetiva parametrizada, 3. Health e liveness, 4. Operação e rollback, Context, Decisions, Goals / Non-Goals, Risks / Trade-offs (+1 more)

### Community 38 - "Requirement: Publicação Tailscale explícita e restrita"
Cohesion: 0.20
Nodes (9): ADDED Requirements, Requirement: Publicação Tailscale explícita e restrita, Requirement: Verificação e rollback do acesso Tailscale, Scenario: Binding Tailscale é verificado, Scenario: Default seguro permanece local, Scenario: Endereço CGNAT não pertence ao host Tailscale, Scenario: Operador retorna ao loopback, Scenario: Operador seleciona o IPv4 Tailscale (+1 more)

### Community 39 - "Design: Workspace Agent Dashboard"
Cohesion: 0.20
Nodes (9): Adapters, Architecture, Deployment, Design: Workspace Agent Dashboard, Refresh and consistency, Security and privacy, Status derivation, Testing (+1 more)

### Community 40 - "ADDED Requirements"
Cohesion: 0.20
Nodes (9): ADDED Requirements, Requirement: Evidence is attributable and verifiable, Requirement: Human decisions are explicit, Requirement: Quality gates are versioned, Requirement: Run success does not equal accepted work, Scenario: Agent reports completion without tests, Scenario: CI evidence targets an older commit, Scenario: Migration is ready to execute (+1 more)

### Community 41 - "plan-repository.ts"
Cohesion: 0.06
Nodes (37): migrationDirectory, names, sql, DryRunClaimStore, evaluateDryRunClaim(), ExternalConfirmationResult, RetentionConfirmationAdapter, UnsupportedRetentionConfirmationAdapter (+29 more)

### Community 42 - "Change: Add workspace agent dashboard"
Cohesion: 0.25
Nodes (7): Change: Add workspace agent dashboard, Data sources, Goals, Impact, Non-goals, Risks, Why

### Community 43 - "container-verifiers.test.ts"
Cohesion: 0.29
Nodes (6): safeDeclared, safeEffective, verifierArgs(), verify(), workspace, workspaceStat

### Community 44 - "versioned-deployment.test.ts"
Cohesion: 0.25
Nodes (3): deploy, harnessDirectories, root

### Community 45 - "contract.ts"
Cohesion: 0.07
Nodes (25): availability, capabilityState, dashboardBaseline, dashboardBaselineSchema, orchestratorBaseline, orchestratorBaselineSchema, taskStatus, OrchestratorCapabilityState (+17 more)

### Community 47 - "PostgreSQL operations"
Cohesion: 0.33
Nodes (5): Backup and restore rehearsal, Incident boundaries, Migrations and readiness, PostgreSQL operations, Role boundaries

### Community 48 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, version

### Community 49 - "ADR 0001: TypeScript control plane with a separate worker"
Cohesion: 0.40
Nodes (4): ADR 0001: TypeScript control plane with a separate worker, Consequences, Context, Decision

### Community 50 - "ADR 0003: Stable OpenSpec task identity"
Cohesion: 0.40
Nodes (4): ADR 0003: Stable OpenSpec task identity, Consequences, Context, Decision

### Community 51 - "ADR 0004: Agent Orchestrator integration hold"
Cohesion: 0.40
Nodes (4): ADR 0004: Agent Orchestrator integration hold, Context, Decision, Exit criteria

### Community 52 - "add-tailscale-dashboard-access/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Contrato e testes, 2. Implementação, 3. Documentação, 4. Validação e publicação

### Community 53 - "add-versioned-deployment-export/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Contrato e testes, 2. Implementação, 3. Operação e documentação, 4. Verificação

### Community 54 - "prepare-containerized-local-deployment/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Contrato e healthcheck, 2. Imagem e Compose seguros, 3. Operação e documentação, 4. Verificação

### Community 56 - "add-tailscale-dashboard-access/proposal.md"
Cohesion: 0.50
Nodes (3): Impact, What Changes, Why

### Community 57 - "add-versioned-deployment-export/proposal.md"
Cohesion: 0.50
Nodes (3): Impact, What Changes, Why

### Community 58 - "compose-safe.sh"
Cohesion: 0.67
Nodes (3): _compose_safe(), compose_safe_no_secret(), compose-safe.sh script

### Community 59 - "dashboard.ts"
Cohesion: 0.15
Nodes (16): dynamic, Home(), DashboardConfig, defaultBoardSlug(), envSchema, readDashboardConfig(), createDashboardService(), createDefaultDashboardService() (+8 more)

### Community 72 - "kanban.ts"
Cohesion: 0.29
Nodes (9): defaultRunner(), execFileAsync, extractTaskArray(), HermesCommandOptions, HermesCommandRunner, mergeBoardTasks(), normalizeHermesTask(), rawTaskSchema (+1 more)

### Community 90 - "ADDED Requirements"
Cohesion: 0.11
Nodes (17): ADDED Requirements, Requirement: Derived copies and backups cannot silently resurrect deleted data, Requirement: Ephemeral filesystem deletion is path-contained, Requirement: Every runtime data class has a versioned retention rule, Requirement: Holds and tombstones preserve evidence without preserving payloads indefinitely, Requirement: Privacy status is accessible and does not expose sensitive content, Requirement: Retention execution is bounded, idempotent and observable, Scenario: Cleanup candidate escapes through a symlink (+9 more)

### Community 91 - "ADDED Requirements"
Cohesion: 0.13
Nodes (14): ADDED Requirements, Requirement: Activation remains separately authorized, Requirement: Behavioral equivalence is proven per profile, Requirement: Startup and readiness follow the dependency graph, Requirement: Stateful components have compatible backup and rollback, Requirement: The effective Hermes topology is inventoried before containerization, Requirement: The future composition has isolated persistence, networking and secrets, Scenario: Candidate manifest passes static validation (+6 more)

### Community 92 - "ADDED Requirements"
Cohesion: 0.13
Nodes (14): ADDED Requirements, Requirement: Backups are consistent, encrypted, signed and retention-aware, Requirement: Cutover prevents split-brain writes, Requirement: Recovery objectives are explicit and evidence-based, Requirement: Restore rehearsals prove recoverability periodically, Requirement: Rollback is bounded and reconciles post-freeze writes, Requirement: VPS execution remains separately authorized, Scenario: Backup generation exceeds retention (+6 more)

### Community 93 - "containerize-hermes-runtime-topology/design.md"
Cohesion: 0.18
Nodes (10): Context, Decisions, Equivalência antes de composição, Estado e secrets, Goals / Non-Goals, Rollback, Startup, readiness e rollback, Testing (+2 more)

### Community 94 - "govern-runtime-data-retention-and-privacy/design.md"
Cohesion: 0.18
Nodes (10): Context, Decisions, Estados explícitos, Exclusão distribuída e backups, Goals / Non-Goals, Matriz versionada e precedência, Privacidade e segurança, Rollback (+2 more)

### Community 95 - "rehearse-disaster-recovery-and-vps-cutover/design.md"
Cohesion: 0.18
Nodes (10): Consistência e restore, Context, Cutover e fencing, Decisions, Goals / Non-Goals, Objetivos por tier, Proteção criptográfica, Rollback (+2 more)

### Community 96 - "containerize-hermes-runtime-topology/proposal.md"
Cohesion: 0.22
Nodes (8): Affected data sources, Capabilities, Goals, New Capabilities, Non-Goals, Operational risks, What Changes, Why

### Community 97 - "govern-runtime-data-retention-and-privacy/proposal.md"
Cohesion: 0.22
Nodes (8): Affected data sources, Capabilities, Goals, New Capabilities, Non-Goals, Operational risks, What Changes, Why

### Community 98 - "rehearse-disaster-recovery-and-vps-cutover/proposal.md"
Cohesion: 0.22
Nodes (8): Affected data sources, Capabilities, Goals, New Capabilities, Non-Goals, Operational risks, What Changes, Why

### Community 99 - "openspec.ts"
Cohesion: 0.44
Nodes (8): descriptorPath(), openDirectory(), openDirectoryAt(), parseTasksMarkdown(), readOpenSpecEvidence(), readTasksAt(), taskId(), created

### Community 100 - "containerize-hermes-runtime-topology/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Inventory and contracts, 2. Equivalence harness, 3. Candidate topology, 4. Deferred activation gate

### Community 101 - "govern-runtime-data-retention-and-privacy/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Policy contract, 2. Planner and persistence, 3. Executors and propagation, 4. Operations and gates

### Community 102 - "rehearse-disaster-recovery-and-vps-cutover/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Objectives and inventory, 2. Protected backup, 3. Restore rehearsal, 4. Deferred cutover gate

### Community 103 - "readiness.ts"
Cohesion: 0.39
Nodes (6): assertSchemaReady(), checkSchemaReadiness(), evaluateSchemaReadiness(), REQUIRED_SCHEMA_MIGRATIONS, SchemaReadiness, integration

### Community 104 - "JobQueueRepository"
Cohesion: 0.28
Nodes (3): ClaimedJob, JobQueueRepository, integration

### Community 105 - "worktree-cleanup.ts"
Cohesion: 0.38
Nodes (4): isWithin(), planWorktreeCleanup(), created, WorktreeCleanupPlan

### Community 106 - "repository-postgres.integration.test.ts"
Cohesion: 0.22
Nodes (14): documents, externalBindings, projectSources, specChanges, specRequirements, specScenarios, specTasks, syncRuns (+6 more)

### Community 108 - "workspace.ts"
Cohesion: 0.38
Nodes (7): decodeProjectId(), discoverProjects(), encodeProjectName(), isWithin(), MARKERS, resolveProjectPath(), created

### Community 109 - "ledger.ts"
Cohesion: 0.11
Nodes (24): adaptPilotCost(), aggregateCosts(), assertInteger(), authorizePaidRoute(), BudgetAlert, BudgetEvidence, canonicalUsage(), COST_CLASSES (+16 more)

### Community 111 - "databaseSchema"
Cohesion: 0.31
Nodes (3): databaseSchema, OpenSpecReadRepository, ProjectCatalogRepository

## Knowledge Gaps
- **559 isolated node(s):** `config`, `nextConfig`, `name`, `version`, `private` (+554 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createDatabaseConnection()` connect `connection.ts` to `readiness.ts`, `JobQueueRepository`, `schema.ts`, `repository-postgres.integration.test.ts`, `[id]/page.tsx`, `dashboard.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `createDefaultDashboardService()` connect `dashboard.ts` to `chat/route.ts`, `openspec.ts`, `kanban.ts`, `workspace.ts`, `catalog-repository.ts`, `[id]/page.tsx`, `connection.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `databaseSchema` connect `databaseSchema` to `snapshot.ts`, `schema.ts`, `background-sync.ts`, `repository-postgres.integration.test.ts`, `catalog-repository.ts`, `connection.ts`, `sync-health.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `createDefaultDashboardService()` (e.g. with `readGitEvidence()` and `readHermesEvidence()`) actually correct?**
  _`createDefaultDashboardService()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config`, `nextConfig`, `name` to the rest of the system?**
  _559 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._
- **Should `domain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06471631205673758 - nodes in this community are weakly interconnected._