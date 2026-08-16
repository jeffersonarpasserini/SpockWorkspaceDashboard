import { describe, expect, it } from "vitest";
import { planRetention, RETENTION_MATRIX, RUNTIME_DATA_CLASSES, validateRetentionMatrix, type RetentionRule } from "./policy";

const day = 86_400_000;
const started = new Date("2026-01-01T00:00:00Z");

describe("runtime retention policy", () => {
  it("defines exactly one complete rule for every durable, derived and ephemeral class", () => {
    expect(RETENTION_MATRIX.map(({ dataClass }) => dataClass)).toEqual(RUNTIME_DATA_CLASSES);
    expect(() => validateRetentionMatrix(RETENTION_MATRIX)).not.toThrow();
    expect(() => validateRetentionMatrix(RETENTION_MATRIX.slice(1))).toThrow(/missing.*domain_events/);
    expect(() => validateRetentionMatrix([...RETENTION_MATRIX, RETENTION_MATRIX[0]])).toThrow(/duplicate/);
  });

  it("rejects unknown, self-derived and unsafe duration rules", () => {
    const base = RETENTION_MATRIX[0];
    expect(() => validateRetentionMatrix(RETENTION_MATRIX.map((rule) => rule === base ? { ...rule, activeDays: -1 } : rule))).toThrow(/activeDays/);
    expect(() => validateRetentionMatrix(RETENTION_MATRIX.map((rule) => rule === base ? { ...rule, derivedCopies: ["domain_events"] } : rule))).toThrow(/derive itself/);
    expect(() => validateRetentionMatrix(RETENTION_MATRIX.map((rule) => rule === base ? { ...rule, dataClass: "unknown" } as unknown as RetentionRule : rule))).toThrow(/unknown/);
  });

  it("calculates active, expired, tombstoned and purge-due states using a controlled clock", () => {
    const rule = { ...RETENTION_MATRIX[0], activeDays: 10, tombstoneDays: 5, purgeWithinDays: 2 };
    expect(planRetention(rule, started, new Date(started.getTime() + 9 * day)).state).toBe("active");
    expect(planRetention(rule, started, new Date(started.getTime() + 10 * day)).state).toBe("expired");
    expect(planRetention(rule, started, new Date(started.getTime() + 15 * day)).state).toBe("tombstoned");
    expect(planRetention(rule, started, new Date(started.getTime() + 17 * day)).state).toBe("purge_due");
  });

  it("applies only valid active holds and resumes normal lifecycle after expiry", () => {
    const rule = { ...RETENTION_MATRIX[0], activeDays: 10, tombstoneDays: 5, purgeWithinDays: 2 };
    const hold = { id: "hold-1", startsAt: new Date(started.getTime() + 9 * day), expiresAt: new Date(started.getTime() + 20 * day), authorizedBy: "privacy-operator", reasonCode: "incident" };
    expect(planRetention(rule, started, new Date(started.getTime() + 17 * day), [hold])).toMatchObject({ state: "held", activeHoldIds: ["hold-1"] });
    expect(planRetention(rule, started, new Date(started.getTime() + 21 * day), [hold]).state).toBe("purge_due");
    expect(() => planRetention(rule, started, new Date(started.getTime() + 17 * day), [{ ...hold, authorizedBy: "" }])).toThrow(/authorized/);
  });

  it("requires external confirmation for data outside control-plane authority", () => {
    const sessionRule = RETENTION_MATRIX.find(({ dataClass }) => dataClass === "sessions")!;
    expect(planRetention(sessionRule, started, new Date("2030-01-01T00:00:00Z")).requiresExternalConfirmation).toBe(true);
  });
});

