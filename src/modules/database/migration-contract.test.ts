// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("control-plane foundation migration", () => {
  it("is transactional and creates only the Spock schema foundation", async () => {
    const sql = await readFile(path.join(process.cwd(), "database/migrations/0001_control_plane_foundation.sql"), "utf8");
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS spock");
    expect(sql).not.toMatch(/CREATE\s+(DATABASE|ROLE|USER)/i);
    expect(sql).not.toContain("agent_orchestrator.");
    expect(sql).not.toContain("honcho.");
  });

  it("contains durable jobs, outbox and append-only event ledgers", async () => {
    const sql = await readFile(path.join(process.cwd(), "database/migrations/0001_control_plane_foundation.sql"), "utf8");
    for (const table of ["domain_events", "jobs", "outbox_events", "audit_events", "sync_runs"]) {
      expect(sql).toContain(`CREATE TABLE spock.${table}`);
    }
    expect(sql).toContain("jobs_claimable_idx");
    expect(sql).toContain("outbox_unpublished_idx");
  });
});

describe("OpenSpec governance migration", () => {
  it("is forward-only, transactional and remains isolated in the Spock schema", async () => {
    const sql = await readFile(path.join(process.cwd(), "database/migrations/0002_openspec_governance.sql"), "utf8");
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).not.toMatch(/CREATE\s+(DATABASE|ROLE|USER)/i);
    expect(sql).not.toContain("agent_orchestrator.");
    expect(sql).not.toContain("honcho.");
  });

  it("creates changes, requirements, scenarios, tasks and explicit bindings", async () => {
    const sql = await readFile(path.join(process.cwd(), "database/migrations/0002_openspec_governance.sql"), "utf8");
    for (const table of ["spec_changes", "spec_requirements", "spec_scenarios", "spec_tasks", "external_bindings"]) {
      expect(sql).toContain(`CREATE TABLE spock.${table}`);
    }
    expect(sql).toContain("identity_status");
    expect(sql).toContain("repository_binding");
  });
});

describe("OpenSpec observed-reference migration", () => {
  it("preserves ambiguous source references separately from stable bindings", async () => {
    const sql = await readFile(path.join(process.cwd(), "database/migrations/0003_openspec_observed_references.sql"), "utf8");
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toContain("ADD COLUMN observed_ref text");
    expect(sql).toContain("spec_tasks_stable_ref_consistent");
  });
});

describe("event retention and job claim migration", () => {
  it("enforces append-only event ledgers with explicit minimum retention", async () => {
    const migration = await readFile(path.join(process.cwd(), "database/migrations/0004_event_retention_and_job_claims.sql"), "utf8");
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).toContain("CREATE TABLE spock.retention_policies");
    expect(migration).toContain("retention_days >= 30");
    expect(migration).toContain("domain_events_append_only");
    expect(migration).toContain("audit_events_append_only");
    expect(migration).toContain("outbox_events_retained_delete");
    expect(migration).toContain("jobs_expired_claim_idx");
    expect(migration).not.toMatch(/CREATE\s+(DATABASE|ROLE|USER)/i);
  });
});

describe("retention trigger forward fix", () => {
  it("uses table-specific branches so PostgreSQL never resolves a missing OLD field", async () => {
    const migration = await readFile(path.join(process.cwd(), "database/migrations/0005_fix_retention_trigger_record_timestamp.sql"), "utf8");
    expect(migration).toContain("IF TG_TABLE_NAME = 'outbox_events' THEN");
    expect(migration).toContain("recorded := OLD.created_at");
    expect(migration).toContain("recorded := OLD.recorded_at");
    expect(migration).not.toContain("CASE WHEN TG_TABLE_NAME");
  });
});

describe("agent catalog migration", () => {
  it("separates stable roles from immutable profile versions and bounded assignments", async () => {
    const migration = await readFile(path.join(process.cwd(), "database/migrations/0006_agent_catalog.sql"), "utf8");
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    for (const table of ["agents", "agent_profile_versions", "team_roles", "agent_project_scopes", "team_role_assignments"]) {
      expect(migration).toContain(`CREATE TABLE spock.${table}`);
    }
    expect(migration).toContain("agent_profile_versions_immutable");
    expect(migration).toContain("ends_at IS NULL OR ends_at >= starts_at");
    expect(migration).not.toMatch(/CREATE\s+(DATABASE|ROLE|USER)/i);
  });
});

describe("runtime retention governance migration", () => {
  it("adds immutable policy versions, bounded holds, tombstones and resumable dry-run plans", async () => {
    const migration = await readFile(path.join(process.cwd(), "database/migrations/0007_runtime_retention_governance.sql"), "utf8");
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    for (const table of ["retention_policy_versions", "retention_holds", "retention_tombstones", "retention_plans", "retention_plan_items"]) {
      expect(migration).toContain(`CREATE TABLE spock.${table}`);
    }
    expect(migration).toContain("retention_policy_versions_immutable");
    expect(migration).toContain("dry_run IN (0, 1)");
    expect(migration).toContain("UNIQUE (workspace_id, idempotency_key)");
    expect(migration).toMatch(/CREATE TABLE spock\.retention_plans \([\s\S]*idempotency_key text NOT NULL[\s\S]*UNIQUE \(workspace_id, idempotency_key\)/);
    expect(migration).toContain("target_id_hash");
    expect(migration).not.toMatch(/CREATE\s+(DATABASE|ROLE|USER)/i);
    expect(migration).not.toContain("agent_orchestrator.");
    expect(migration).not.toContain("honcho.");
  });
});
