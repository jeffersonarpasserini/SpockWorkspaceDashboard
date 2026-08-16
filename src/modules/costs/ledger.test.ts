import { describe, expect, it } from "vitest";
import {
  UsageLedger,
  adaptPilotCost,
  aggregateCosts,
  authorizePaidRoute,
  evaluateBudget,
  priceUsage,
  type PriceEntry,
  type UsageEvent
} from "./ledger";

const base: UsageEvent = {
  sourceEventId: "usage-1",
  occurredAt: "2026-08-16T12:00:00.000Z",
  workspaceId: "workspace-1",
  projectId: "project-1",
  taskId: "task-1",
  runId: "run-1",
  agentId: "agent-1",
  provider: "provider-a",
  model: "model-a",
  kind: "input",
  quantity: 2_000,
  costClass: "actual"
};

const prices: readonly PriceEntry[] = [{
  id: "price-1",
  provider: "provider-a",
  model: "model-a",
  kind: "input",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  currency: "USD",
  microCurrencyPerMillionUnits: 2_000_000,
  source: "provider price sheet",
  confidence: "authoritative"
}];

describe("usage and cost ledger", () => {
  it("is idempotent for generated quantities and rejects conflicting identities", () => {
    for (let quantity = 0; quantity < 100; quantity += 7) {
      const ledger = new UsageLedger();
      const event = { ...base, sourceEventId: `usage-${quantity}`, quantity };
      expect(ledger.ingest(event)).toBe("inserted");
      expect(ledger.ingest({ ...event })).toBe("duplicate");
      expect(ledger.events()).toHaveLength(1);
      expect(() => ledger.ingest({ ...event, quantity: quantity + 1 })).toThrow("Conflicting");
    }
  });

  it("records an exact compensating correction without crossing boundaries", () => {
    const ledger = new UsageLedger();
    ledger.ingest(base);
    const correction = { ...base, sourceEventId: "usage-1-correction", quantity: -2_000, compensatesEventId: "usage-1" };
    expect(ledger.ingest(correction)).toBe("inserted");
    expect(() => ledger.ingest({ ...correction, sourceEventId: "again" })).toThrow("already compensated");
    expect(() => new UsageLedger().ingest({ ...correction, projectId: "other" })).toThrow("does not exist");
  });

  it("uses effective-dated prices and preserves exact integer micro-currency", () => {
    expect(priceUsage(base, prices)).toMatchObject({
      amountMicros: 4_000n,
      currency: "USD",
      costClass: "actual",
      confidence: "authoritative"
    });
  });

  it("does not mix cost classes or aggregation boundaries", () => {
    const actual = priceUsage(base, prices);
    const simulated = { ...actual, usageEventId: "sim-1", costClass: "simulated" as const, confidence: "simulated" as const };
    expect(aggregateCosts([actual, simulated], "project")).toEqual([
      expect.objectContaining({ groupKey: "project-1", costClass: "actual", amountMicros: 4_000n }),
      expect.objectContaining({ groupKey: "project-1", costClass: "simulated", amountMicros: 4_000n })
    ]);
    expect(aggregateCosts([{ ...actual, taskId: undefined }], "task")).toEqual([]);
  });

  it("adapts pilot aggregates without pretending simulated values were billed", () => {
    const common = { ...base, sourceId: "legacy-1", amountMicros: 300, currency: "USD" };
    expect(adaptPilotCost({ ...common, billed: false })).toMatchObject({ costClass: "simulated", confidence: "simulated" });
    expect(adaptPilotCost({ ...common, billed: true })).toMatchObject({ costClass: "actual", confidence: "authoritative" });
  });

  it("fails closed for paid routes without authoritative sufficient budget", () => {
    expect(() => authorizePaidRoute(10n)).toThrow("authoritative");
    expect(() => authorizePaidRoute(10n, { currency: "USD", remainingMicros: 100n, authoritative: false, observedAt: base.occurredAt })).toThrow("authoritative");
    expect(() => authorizePaidRoute(101n, { currency: "USD", remainingMicros: 100n, authoritative: true, observedAt: base.occurredAt })).toThrow("Insufficient");
    expect(() => authorizePaidRoute(100n, { currency: "USD", remainingMicros: 100n, authoritative: true, observedAt: base.occurredAt })).not.toThrow();
    expect(() => authorizePaidRoute(0n)).not.toThrow();
  });

  it("raises explicit budget states without treating missing evidence as zero", () => {
    const evidence = { currency: "USD", remainingMicros: 100n, authoritative: true, observedAt: base.occurredAt };
    expect(evaluateBudget(undefined, 50n)).toBe("unavailable");
    expect(evaluateBudget({ ...evidence, authoritative: false }, 50n)).toBe("unavailable");
    expect(evaluateBudget({ ...evidence, remainingMicros: 0n }, 50n)).toBe("critical");
    expect(evaluateBudget(evidence, 100n)).toBe("warning");
    expect(evaluateBudget(evidence, 50n)).toBe("ok");
  });
});
