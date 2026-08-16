import { describe, expect, it } from "vitest";
import { reconcileRestoreInventory } from "./restore-reconciliation";

const restoredAt = new Date("2026-08-15T00:00:00Z");
const deletedHash = "a".repeat(64);
const retainedHash = "b".repeat(64);

describe("restore tombstone reconciliation", () => {
  it("blocks active tombstones before traffic and allows unrelated artifacts", () => {
    const result = reconcileRestoreInventory({
      restoredAt,
      inventory: [
        { dataClass: "sessions", targetIdHash: deletedHash, artifactRef: "sessions/deleted.json" },
        { dataClass: "sessions", targetIdHash: retainedHash, artifactRef: "sessions/retained.json" }
      ],
      tombstones: [{ dataClass: "sessions", targetIdHash: deletedHash, policyRevision: 1, deletedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2027-01-01T00:00:00Z") }]
    });
    expect(result.readyForTraffic).toBe(false);
    expect(result.allowed).toEqual([{ dataClass: "sessions", targetIdHash: retainedHash, artifactRef: "sessions/retained.json" }]);
    expect(result.blocked).toEqual([{ dataClass: "sessions", targetIdHash: deletedHash, policyRevision: 1, reason: "active_tombstone" }]);
    expect(JSON.stringify(result)).not.toContain("deleted.json");
  });

  it("does not apply expired tombstones but rejects ambiguous inventory", () => {
    const item = { dataClass: "sessions" as const, targetIdHash: deletedHash, artifactRef: "sessions/item.json" };
    expect(reconcileRestoreInventory({ restoredAt, inventory: [item], tombstones: [{ dataClass: "sessions", targetIdHash: deletedHash, policyRevision: 1, deletedAt: new Date("2025-01-01T00:00:00Z"), expiresAt: new Date("2026-01-01T00:00:00Z") }] })).toMatchObject({ readyForTraffic: true, allowed: [item], blocked: [] });
    expect(() => reconcileRestoreInventory({ restoredAt, inventory: [item, item], tombstones: [] })).toThrow(/duplicate/);
    expect(() => reconcileRestoreInventory({ restoredAt, inventory: [{ ...item, artifactRef: "../escape" }], tombstones: [] })).toThrow(/invalid/);
  });
});

