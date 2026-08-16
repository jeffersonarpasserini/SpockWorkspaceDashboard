import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const spockSchema = pgSchema("spock");

export const workspaces = spockSchema.table("workspaces", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  check("workspaces_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  check("workspaces_slug_format", sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]*$'`),
  check("workspaces_version_positive", sql`${table.version} > 0`)
]);

export const projects = spockSchema.table("projects", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("projects_workspace_slug_unique").on(table.workspaceId, table.slug),
  check("projects_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  check("projects_slug_format", sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]*$'`),
  check("projects_status_valid", sql`${table.status} IN ('active', 'paused', 'completed', 'archived')`),
  check("projects_version_positive", sql`${table.version} > 0`),
  check("projects_dates_ordered", sql`${table.completedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`)
]);

export const projectSources = spockSchema.table("project_sources", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  kind: text("kind").notNull(),
  externalId: text("external_id"),
  configuration: jsonb("configuration").notNull().default({}),
  syncStatus: text("sync_status").notNull().default("pending"),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
  lastAttemptedSyncAt: timestamp("last_attempted_sync_at", { withTimezone: true }),
  sourceRevision: text("source_revision"),
  sanitizedErrorClass: text("sanitized_error_class"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  check("project_sources_kind_valid", sql`${table.kind} IN ('filesystem', 'git', 'openspec', 'hermes', 'github', 'gitlab')`),
  check("project_sources_sync_status_valid", sql`${table.syncStatus} IN ('pending', 'syncing', 'available', 'stale', 'unavailable')`),
  check("project_sources_version_positive", sql`${table.version} > 0`)
]);

export const documents = spockSchema.table("documents", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sourceId: uuid("source_id").notNull().references(() => projectSources.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  relativePath: text("relative_path").notNull(),
  contentHash: text("content_hash").notNull(),
  sourceRevision: text("source_revision"),
  lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }).notNull(),
  missingAt: timestamp("missing_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("documents_source_path_unique").on(table.sourceId, table.relativePath),
  check("documents_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("documents_relative_path_safe", sql`${table.relativePath} <> '' AND ${table.relativePath} !~ '(^|/)\.\.(/|$)'`),
  check("documents_version_positive", sql`${table.version} > 0`)
]);

export const syncRuns = spockSchema.table("sync_runs", {
  id: uuid("id").primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => projectSources.id),
  status: text("status").notNull(),
  sourceRevision: text("source_revision"),
  resultCounts: jsonb("result_counts").notNull().default({}),
  sanitizedErrorClass: text("sanitized_error_class"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true })
}, (table) => [
  check("sync_runs_status_valid", sql`${table.status} IN ('running', 'succeeded', 'failed', 'partial')`),
  check("sync_runs_dates_ordered", sql`${table.finishedAt} IS NULL OR ${table.finishedAt} >= ${table.startedAt}`)
]);

export const retentionPolicies = spockSchema.table("retention_policies", {
  ledger: text("ledger").primaryKey(),
  retentionDays: integer("retention_days").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("retention_policies_ledger_valid", sql`${table.ledger} IN ('domain_events', 'audit_events', 'outbox_events')`),
  check("retention_policies_days_minimum", sql`${table.retentionDays} >= 30`)
]);

export const retentionPolicyVersions = spockSchema.table("retention_policy_versions", {
  id: uuid("id").primaryKey(),
  dataClass: text("data_class").notNull(),
  policyRevision: integer("policy_revision").notNull(),
  authority: text("authority").notNull(),
  classification: text("classification").notNull(),
  retentionClock: text("retention_clock").notNull(),
  activeDays: integer("active_days").notNull(),
  tombstoneDays: integer("tombstone_days").notNull(),
  purgeWithinDays: integer("purge_within_days").notNull(),
  confirmationMode: text("confirmation_mode").notNull(),
  derivedCopies: jsonb("derived_copies").notNull().default([]),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("retention_policy_versions_revision_unique").on(table.dataClass, table.policyRevision),
  check("retention_policy_versions_revision_positive", sql`${table.policyRevision} > 0`),
  check("retention_policy_versions_active_days", sql`${table.activeDays} >= 0`),
  check("retention_policy_versions_tombstone_days", sql`${table.tombstoneDays} >= 0`),
  check("retention_policy_versions_purge_days", sql`${table.purgeWithinDays} > 0`),
  check("retention_policy_versions_derived_array", sql`jsonb_typeof(${table.derivedCopies}) = 'array'`),
  check("retention_policy_versions_dates", sql`${table.retiredAt} IS NULL OR ${table.retiredAt} > ${table.effectiveAt}`)
]);

export const retentionHolds = spockSchema.table("retention_holds", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  dataClass: text("data_class").notNull(),
  targetId: text("target_id").notNull(),
  authorizedBy: text("authorized_by").notNull(),
  reasonCode: text("reason_code").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("retention_holds_active_idx").on(table.workspaceId, table.dataClass, table.targetId, table.expiresAt).where(sql`${table.releasedAt} IS NULL`),
  check("retention_holds_dates", sql`${table.expiresAt} > ${table.startsAt}`),
  check("retention_holds_release_date", sql`${table.releasedAt} IS NULL OR ${table.releasedAt} >= ${table.startsAt}`)
]);

export const retentionTombstones = spockSchema.table("retention_tombstones", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  dataClass: text("data_class").notNull(),
  targetIdHash: text("target_id_hash").notNull(),
  policyRevision: integer("policy_revision").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("retention_tombstones_target_unique").on(table.workspaceId, table.dataClass, table.targetIdHash),
  check("retention_tombstones_hash", sql`${table.targetIdHash} ~ '^[0-9a-f]{64}$'`),
  check("retention_tombstones_revision", sql`${table.policyRevision} > 0`),
  check("retention_tombstones_dates", sql`${table.expiresAt} >= ${table.deletedAt}`)
]);

export const retentionPlans = spockSchema.table("retention_plans", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  idempotencyKey: text("idempotency_key").notNull(),
  policyRevisionSetHash: text("policy_revision_set_hash").notNull(),
  dryRun: integer("dry_run").notNull().default(1),
  status: text("status").notNull().default("planned"),
  plannedAt: timestamp("planned_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sanitizedErrorClass: text("sanitized_error_class"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("retention_plans_idempotency_unique").on(table.workspaceId, table.idempotencyKey),
  check("retention_plans_hash", sql`${table.policyRevisionSetHash} ~ '^[0-9a-f]{64}$'`),
  check("retention_plans_dry_run", sql`${table.dryRun} IN (0, 1)`),
  check("retention_plans_dates", sql`${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.plannedAt}`)
]);

export const retentionPlanItems = spockSchema.table("retention_plan_items", {
  id: uuid("id").primaryKey(),
  planId: uuid("plan_id").notNull().references(() => retentionPlans.id),
  dataClass: text("data_class").notNull(),
  targetIdHash: text("target_id_hash").notNull(),
  decision: text("decision").notNull(),
  confirmationState: text("confirmation_state").notNull().default("pending"),
  claimedBy: text("claimed_by"),
  claimedUntil: timestamp("claimed_until", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  sanitizedErrorClass: text("sanitized_error_class"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("retention_plan_items_target_unique").on(table.planId, table.dataClass, table.targetIdHash),
  index("retention_plan_items_claim_idx").on(table.planId, table.confirmationState, table.claimedUntil, table.createdAt),
  check("retention_plan_items_hash", sql`${table.targetIdHash} ~ '^[0-9a-f]{64}$'`),
  check("retention_plan_items_attempts", sql`${table.attempts} >= 0`),
  check("retention_plan_items_claim", sql`(${table.claimedBy} IS NULL) = (${table.claimedUntil} IS NULL)`)
]);

export const specChanges = spockSchema.table("spec_changes", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sourceId: uuid("source_id").notNull().references(() => projectSources.id),
  changeKey: text("change_key").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"),
  sourceRevision: text("source_revision").notNull(),
  missingAt: timestamp("missing_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("spec_changes_source_key_unique").on(table.sourceId, table.changeKey),
  check("spec_changes_key_format", sql`${table.changeKey} ~ '^[a-z0-9][a-z0-9-]*$'`),
  check("spec_changes_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("spec_changes_status_valid", sql`${table.status} IN ('active', 'archived', 'missing', 'conflicted')`),
  check("spec_changes_version_positive", sql`${table.version} > 0`)
]);

export const specRequirements = spockSchema.table("spec_requirements", {
  id: uuid("id").primaryKey(),
  changeId: uuid("change_id").notNull().references(() => specChanges.id),
  capability: text("capability").notNull(),
  externalRef: text("external_ref"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  ordinal: integer("ordinal").notNull(),
  sourceRevision: text("source_revision").notNull(),
  missingAt: timestamp("missing_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("spec_requirements_change_ref_unique").on(table.changeId, table.externalRef),
  check("spec_requirements_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("spec_requirements_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
  check("spec_requirements_version_positive", sql`${table.version} > 0`)
]);

export const specScenarios = spockSchema.table("spec_scenarios", {
  id: uuid("id").primaryKey(),
  requirementId: uuid("requirement_id").notNull().references(() => specRequirements.id),
  externalRef: text("external_ref"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  ordinal: integer("ordinal").notNull(),
  sourceRevision: text("source_revision").notNull(),
  missingAt: timestamp("missing_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("spec_scenarios_requirement_ref_unique").on(table.requirementId, table.externalRef),
  check("spec_scenarios_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("spec_scenarios_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
  check("spec_scenarios_version_positive", sql`${table.version} > 0`)
]);

export const specTasks = spockSchema.table("spec_tasks", {
  id: uuid("id").primaryKey(),
  changeId: uuid("change_id").notNull().references(() => specChanges.id),
  externalRef: text("external_ref"),
  observedRef: text("observed_ref"),
  section: text("section").notNull(),
  title: text("title").notNull(),
  checked: integer("checked").notNull().default(0),
  ordinal: integer("ordinal").notNull(),
  sourceRevision: text("source_revision").notNull(),
  identityStatus: text("identity_status").notNull(),
  missingAt: timestamp("missing_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("spec_tasks_change_ref_unique").on(table.changeId, table.externalRef),
  check("spec_tasks_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("spec_tasks_stable_ref_consistent", sql`${table.identityStatus} <> 'stable' OR ${table.externalRef} IS NOT NULL`),
  check("spec_tasks_checked_boolean", sql`${table.checked} IN (0, 1)`),
  check("spec_tasks_ordinal_nonnegative", sql`${table.ordinal} >= 0`),
  check("spec_tasks_identity_status_valid", sql`${table.identityStatus} IN ('stable', 'unstable', 'conflicted')`),
  check("spec_tasks_version_positive", sql`${table.version} > 0`)
]);

export const externalBindings = spockSchema.table("external_bindings", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sourceId: uuid("source_id").notNull().references(() => projectSources.id),
  entityType: text("entity_type").notNull(),
  externalKey: text("external_key").notNull(),
  entityId: uuid("entity_id").notNull(),
  provenance: text("provenance").notNull(),
  sourceRevision: text("source_revision").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("external_bindings_source_key_unique").on(table.sourceId, table.entityType, table.externalKey),
  unique("external_bindings_entity_unique").on(table.sourceId, table.entityType, table.entityId),
  check("external_bindings_entity_type_valid", sql`${table.entityType} IN ('change', 'requirement', 'scenario', 'task', 'document')`),
  check("external_bindings_key_not_blank", sql`length(btrim(${table.externalKey})) > 0`),
  check("external_bindings_provenance_valid", sql`${table.provenance} IN ('hierarchical_ref', 'repository_binding', 'human_confirmed')`)
]);

export const agents = spockSchema.table("agents", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  agentKey: text("agent_key").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("agents_workspace_key_unique").on(table.workspaceId, table.agentKey),
  check("agents_key_format", sql`${table.agentKey} ~ '^[a-z0-9][a-z0-9-]*$'`),
  check("agents_display_name_not_blank", sql`length(btrim(${table.displayName})) > 0`),
  check("agents_status_valid", sql`${table.status} IN ('active', 'disabled', 'retired')`),
  check("agents_version_positive", sql`${table.version} > 0`)
]);

export const agentProfileVersions = spockSchema.table("agent_profile_versions", {
  id: uuid("id").primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  profileVersion: integer("profile_version").notNull(),
  externalProfile: text("external_profile").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  billingMode: text("billing_mode").notNull(),
  configurationHash: text("configuration_hash").notNull(),
  capabilities: jsonb("capabilities").notNull().default([]),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("agent_profile_versions_number_unique").on(table.agentId, table.profileVersion),
  unique("agent_profile_versions_hash_unique").on(table.agentId, table.configurationHash),
  check("agent_profile_versions_number_positive", sql`${table.profileVersion} > 0`),
  check("agent_profile_versions_profile_not_blank", sql`length(btrim(${table.externalProfile})) > 0`),
  check("agent_profile_versions_provider_not_blank", sql`length(btrim(${table.provider})) > 0`),
  check("agent_profile_versions_model_not_blank", sql`length(btrim(${table.model})) > 0`),
  check("agent_profile_versions_hash_format", sql`${table.configurationHash} ~ '^[0-9a-f]{64}$'`),
  check("agent_profile_versions_capabilities_array", sql`jsonb_typeof(${table.capabilities}) = 'array'`)
]);

export const teamRoles = spockSchema.table("team_roles", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  roleKey: text("role_key").notNull(),
  name: text("name").notNull(),
  responsibility: text("responsibility").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("team_roles_workspace_key_unique").on(table.workspaceId, table.roleKey),
  check("team_roles_key_format", sql`${table.roleKey} ~ '^[a-z0-9][a-z0-9-]*$'`),
  check("team_roles_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  check("team_roles_responsibility_not_blank", sql`length(btrim(${table.responsibility})) > 0`),
  check("team_roles_version_positive", sql`${table.version} > 0`)
]);

export const agentProjectScopes = spockSchema.table("agent_project_scopes", {
  id: uuid("id").primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  policy: text("policy").notNull().default("allow"),
  capabilities: jsonb("capabilities").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: bigint("version", { mode: "number" }).notNull().default(1)
}, (table) => [
  unique("agent_project_scopes_unique").on(table.agentId, table.projectId),
  check("agent_project_scopes_policy_valid", sql`${table.policy} IN ('allow', 'deny')`),
  check("agent_project_scopes_capabilities_array", sql`jsonb_typeof(${table.capabilities}) = 'array'`),
  check("agent_project_scopes_version_positive", sql`${table.version} > 0`)
]);

export const teamRoleAssignments = spockSchema.table("team_role_assignments", {
  id: uuid("id").primaryKey(),
  roleId: uuid("role_id").notNull().references(() => teamRoles.id),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  projectId: uuid("project_id").references(() => projects.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("team_role_assignments_active_idx").on(table.roleId, table.projectId, table.startsAt),
  check("team_role_assignments_dates_ordered", sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`)
]);

export const domainEvents = spockSchema.table("domain_events", {
  sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
  eventId: uuid("event_id").notNull().unique(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  projectId: uuid("project_id").references(() => projects.id),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  correlationId: text("correlation_id"),
  causationId: uuid("causation_id"),
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
});

export const jobs = spockSchema.table("jobs", {
  id: uuid("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("queued"),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  claimedBy: text("claimed_by"),
  claimedUntil: timestamp("claimed_until", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lastErrorClass: text("last_error_class"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("jobs_claimable_idx").on(table.availableAt, table.createdAt).where(sql`${table.status} IN ('queued', 'retry_scheduled')`),
  check("jobs_status_valid", sql`${table.status} IN ('queued', 'claimed', 'retry_scheduled', 'succeeded', 'dead_letter')`),
  check("jobs_attempts_nonnegative", sql`${table.attempts} >= 0`),
  check("jobs_max_attempts_positive", sql`${table.maxAttempts} > 0`),
  check("jobs_claim_consistent", sql`(${table.status} = 'claimed') = (${table.claimedBy} IS NOT NULL AND ${table.claimedUntil} IS NOT NULL)`)
]);

export const outboxEvents = spockSchema.table("outbox_events", {
  sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
  eventId: uuid("event_id").notNull().unique(),
  topic: text("topic").notNull(),
  eventKey: text("event_key").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishAttempts: integer("publish_attempts").notNull().default(0)
}, (table) => [
  index("outbox_unpublished_idx").on(table.sequence).where(sql`${table.publishedAt} IS NULL`),
  check("outbox_publish_attempts_nonnegative", sql`${table.publishAttempts} >= 0`)
]);

export const auditEvents = spockSchema.table("audit_events", {
  sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
  eventId: uuid("event_id").notNull().unique(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  projectId: uuid("project_id").references(() => projects.id),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  requestId: text("request_id"),
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
});

export const databaseSchema = {
  workspaces,
  projects,
  projectSources,
  documents,
  syncRuns,
  retentionPolicies,
  retentionPolicyVersions,
  retentionHolds,
  retentionTombstones,
  retentionPlans,
  retentionPlanItems,
  specChanges,
  specRequirements,
  specScenarios,
  specTasks,
  externalBindings,
  agents,
  agentProfileVersions,
  teamRoles,
  agentProjectScopes,
  teamRoleAssignments,
  domainEvents,
  jobs,
  outboxEvents,
  auditEvents
};
