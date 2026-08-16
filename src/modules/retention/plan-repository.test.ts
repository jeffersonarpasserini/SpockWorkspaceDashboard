import { describe, expect, it } from "vitest";
import { buildDryRunPlan, sanitizeRetentionErrorClass } from "./plan-repository";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const targetHashKey = "retention-test-key-that-is-at-least-32-characters";
const plannedAt = new Date("2026-08-15T00:00:00Z");

describe("retention dry-run plan", () => {
  it("stores only stable keyed hashes and never returns raw target identifiers", () => {
    const targetId = "session/private-identifier";
    const plan = buildDryRunPlan({ workspaceId, idempotencyKey: "retention:2026-08-15", targetHashKey, plannedAt, candidates: [{ dataClass: "sessions", targetId, clockStartedAt: new Date("2025-01-01T00:00:00Z") }] });
    expect(plan).toMatchObject({ dryRun: 1, idempotencyKey: "retention:2026-08-15" });
    expect(plan.items[0]).toMatchObject({ decision: "purge_due", confirmationState: "pending" });
    expect(plan.items[0].targetIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(plan)).not.toContain(targetId);
    const repeated = buildDryRunPlan({ workspaceId, idempotencyKey: "retention:2026-08-15", targetHashKey, plannedAt, candidates: [{ dataClass: "sessions", targetId, clockStartedAt: new Date("2025-01-01T00:00:00Z") }] });
    expect(repeated.items[0].targetIdHash).toBe(plan.items[0].targetIdHash);
  });

  it("bounds candidate batches and rejects duplicate or weakly protected targets", () => {
    const candidate = { dataClass: "domain_events" as const, targetId: "event-1", clockStartedAt: plannedAt };
    expect(() => buildDryRunPlan({ workspaceId, idempotencyKey: "bad key", targetHashKey, plannedAt, candidates: [candidate] })).toThrow(/idempotency/);
    expect(() => buildDryRunPlan({ workspaceId, idempotencyKey: "plan-1", targetHashKey: "short", plannedAt, candidates: [candidate] })).toThrow(/32/);
    expect(() => buildDryRunPlan({ workspaceId, idempotencyKey: "plan-1", targetHashKey, plannedAt, candidates: [candidate, candidate] })).toThrow(/duplicate/);
    expect(() => buildDryRunPlan({ workspaceId, idempotencyKey: "plan-1", targetHashKey, plannedAt, candidates: [] })).toThrow(/1 to 1000/);
  });

  it("reduces adapter failures to a bounded class instead of retaining messages", () => {
    expect(sanitizeRetentionErrorClass("Remote timeout: token=secret and a long message")).toBe("retention_adapter_error");
    expect(sanitizeRetentionErrorClass("remote_timeout")).toBe("remote_timeout");
    expect(sanitizeRetentionErrorClass("***")).toBe("retention_adapter_error");
    expect(sanitizeRetentionErrorClass(`failure-${"x".repeat(100)}`)).toBe("retention_adapter_error");
  });
});
