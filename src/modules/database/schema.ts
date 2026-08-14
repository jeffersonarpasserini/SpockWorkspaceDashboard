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
  specChanges,
  specRequirements,
  specScenarios,
  specTasks,
  externalBindings,
  domainEvents,
  jobs,
  outboxEvents,
  auditEvents
};
