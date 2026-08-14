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
