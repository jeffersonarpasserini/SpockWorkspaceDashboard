import { describe, expect, it } from "vitest";
import { evaluateOperationalHealth } from "./health-metrics";

const healthy = {
  observedAt: "2026-08-16T20:00:00.000Z",
  databaseReachable: true,
  schemaReady: true,
  workerHeartbeatAt: "2026-08-16T19:59:50.000Z",
  workerHeartbeatMaxAgeMs: 30_000,
  oldestQueuedAt: "2026-08-16T19:59:55.000Z",
  reconciliation: { lastCompletedAt: "2026-08-16T19:59:00.000Z", pending: 0, failures: 0 },
  deadLetterCount: 0
};

describe("operational health metrics", () => {
  it("keeps minimal liveness distinct from protected readiness dependencies", () => {
    const result = evaluateOperationalHealth(healthy);
    expect(result.liveness).toEqual({ alive: true });
    expect(result.readiness).toEqual({ ready: true, blockers: [] });
    expect(result.workerHeartbeat).toMatchObject({ state: "healthy", value: { ageMs: 10_000 } });
    expect(result.queueLag).toMatchObject({ state: "healthy", value: 5_000 });
  });

  it("fails readiness while liveness remains healthy", () => {
    const result = evaluateOperationalHealth({
      ...healthy, databaseReachable: false, schemaReady: false,
      workerHeartbeatAt: "2026-08-16T19:00:00.000Z",
      reconciliation: { pending: 2, failures: 1 }, deadLetterCount: 3
    });
    expect(result.liveness.alive).toBe(true);
    expect(result.readiness).toMatchObject({ ready: false, blockers: ["database", "migrations", "worker heartbeat", "reconciliation", "dead letters"] });
    expect(result.deadLetters).toMatchObject({ state: "degraded", value: 3 });
  });

  it("marks unobserved heartbeat, queue and reconciliation unavailable instead of zero", () => {
    const result = evaluateOperationalHealth({
      ...healthy, workerHeartbeatAt: undefined, oldestQueuedAt: undefined,
      reconciliation: { pending: 0, failures: 0 }
    });
    expect(result.workerHeartbeat).toEqual({ state: "unavailable", reason: "worker heartbeat has not been observed" });
    expect(result.queueLag).toEqual({ state: "unavailable", reason: "queue is empty or has not been observed" });
    expect(result.reconciliation).toMatchObject({ state: "unavailable" });
    expect(result.readiness.ready).toBe(false);
  });
});
