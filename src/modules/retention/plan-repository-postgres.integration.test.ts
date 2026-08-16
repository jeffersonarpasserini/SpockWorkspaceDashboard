// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "@/modules/database/connection";
import { buildDryRunPlan, RetentionPlanRepository } from "./plan-repository";

const databaseUrl = process.env.SPOCK_TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL retention dry-run plans", () => {
  let first: DatabaseConnection;
  let second: DatabaseConnection;
  const workspaceId = randomUUID();
  const targetHashKey = "postgres-retention-test-key-at-least-32-characters";

  beforeAll(async () => {
    first = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl });
    second = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl });
    await first.client`INSERT INTO spock.workspaces (id, name, slug) VALUES (${workspaceId}, 'Retention planner', ${`retention-planner-${workspaceId}`})`;
  });

  afterAll(async () => {
    await first.client`DELETE FROM spock.retention_plan_items WHERE plan_id IN (SELECT id FROM spock.retention_plans WHERE workspace_id = ${workspaceId})`;
    await first.client`DELETE FROM spock.retention_plans WHERE workspace_id = ${workspaceId}`;
    await first.client`DELETE FROM spock.workspaces WHERE id = ${workspaceId}`;
    await Promise.all([first.close(), second.close()]);
  });

  it("creates one plan for repeated idempotency keys without storing raw target ids", async () => {
    const repository = new RetentionPlanRepository(first.client);
    const input = { workspaceId, idempotencyKey: "daily:2026-08-15", targetHashKey, plannedAt: new Date("2026-08-15T00:00:00Z"), candidates: [{ dataClass: "sessions" as const, targetId: "private-session-id", clockStartedAt: new Date("2025-01-01T00:00:00Z") }] };
    const firstId = await repository.createDryRun(buildDryRunPlan(input));
    const repeatedId = await repository.createDryRun(buildDryRunPlan(input));
    expect(repeatedId).toBe(firstId);
    const rows = await first.client`SELECT plan.id, item.target_id_hash, item::text AS serialized FROM spock.retention_plans plan JOIN spock.retention_plan_items item ON item.plan_id = plan.id WHERE plan.workspace_id = ${workspaceId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].target_id_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].serialized).not.toContain("private-session-id");
  });

  it("allows one concurrent claim and recovers an expired lease exactly once", async () => {
    const firstRepository = new RetentionPlanRepository(first.client);
    const secondRepository = new RetentionPlanRepository(second.client);
    const claims = await Promise.all([firstRepository.claimNextDryRun("retention-a", 30_000), secondRepository.claimNextDryRun("retention-b", 30_000)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const claimed = claims.find(Boolean)!;
    expect(claimed).toMatchObject({ attempts: 1, decision: "purge_due" });
    await first.client`UPDATE spock.retention_plan_items SET claimed_until = clock_timestamp() - interval '1 second' WHERE id = ${claimed.id}`;
    const recovered = await Promise.all([firstRepository.claimNextDryRun("recovery-a", 30_000), secondRepository.claimNextDryRun("recovery-b", 30_000)]);
    expect(recovered.filter((item) => item?.id === claimed.id)).toHaveLength(1);
    const recoveredClaim = recovered.find((item) => item?.id === claimed.id)!;
    expect(recoveredClaim).toMatchObject({ attempts: 2 });
    const recoveryRepository = recoveredClaim.claimedBy === "recovery-a" ? firstRepository : secondRepository;
    await recoveryRepository.finishDryRunClaim(recoveredClaim.id, recoveredClaim.claimedBy, "failed", "Remote timeout: token=must-not-persist");
    const failedRow = await first.client`SELECT confirmation_state, sanitized_error_class, claimed_by, claimed_until FROM spock.retention_plan_items WHERE id = ${claimed.id}`;
    expect(failedRow[0]).toMatchObject({ confirmation_state: "failed", sanitized_error_class: "retention_adapter_error", claimed_by: null, claimed_until: null });
    expect(JSON.stringify(failedRow)).not.toContain("must-not-persist");

    const retry = await firstRepository.claimNextDryRun("final-worker", 30_000);
    expect(retry).toMatchObject({ id: claimed.id, attempts: 3 });
    await firstRepository.finishDryRunClaim(retry!.id, "final-worker", "unsupported");
    await expect(secondRepository.claimNextDryRun("no-more-work", 30_000)).resolves.toBeNull();
  });
});
