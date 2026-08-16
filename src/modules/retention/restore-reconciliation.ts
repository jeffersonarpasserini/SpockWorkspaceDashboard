import type { RuntimeDataClass } from "./policy";

export interface RestoreInventoryItem {
  dataClass: RuntimeDataClass;
  targetIdHash: string;
  artifactRef: string;
}

export interface RetentionTombstoneRef {
  dataClass: RuntimeDataClass;
  targetIdHash: string;
  policyRevision: number;
  deletedAt: Date;
  expiresAt: Date;
}

export interface RestoreReconciliation {
  allowed: readonly RestoreInventoryItem[];
  blocked: readonly { dataClass: RuntimeDataClass; targetIdHash: string; policyRevision: number; reason: "active_tombstone" }[];
  readyForTraffic: boolean;
}

const HASH = /^[0-9a-f]{64}$/;

export function reconcileRestoreInventory(input: {
  inventory: readonly RestoreInventoryItem[];
  tombstones: readonly RetentionTombstoneRef[];
  restoredAt: Date;
}): RestoreReconciliation {
  if (Number.isNaN(input.restoredAt.getTime())) throw new Error("restore reconciliation time must be valid");
  const active = new Map<string, RetentionTombstoneRef>();
  for (const tombstone of input.tombstones) {
    if (!HASH.test(tombstone.targetIdHash) || !Number.isSafeInteger(tombstone.policyRevision) || tombstone.policyRevision < 1 || Number.isNaN(tombstone.deletedAt.getTime()) || Number.isNaN(tombstone.expiresAt.getTime()) || tombstone.expiresAt < tombstone.deletedAt) {
      throw new Error("invalid retention tombstone evidence");
    }
    if (tombstone.expiresAt >= input.restoredAt) active.set(`${tombstone.dataClass}:${tombstone.targetIdHash}`, tombstone);
  }
  const allowed: RestoreInventoryItem[] = [];
  const blocked: Array<{ dataClass: RuntimeDataClass; targetIdHash: string; policyRevision: number; reason: "active_tombstone" }> = [];
  const seen = new Set<string>();
  for (const item of input.inventory) {
    if (!HASH.test(item.targetIdHash) || !item.artifactRef || item.artifactRef.includes("..") || item.artifactRef.startsWith("/")) throw new Error("invalid restore inventory item");
    const key = `${item.dataClass}:${item.targetIdHash}`;
    if (seen.has(key)) throw new Error("duplicate restore inventory identity");
    seen.add(key);
    const tombstone = active.get(key);
    if (tombstone) blocked.push({ dataClass: item.dataClass, targetIdHash: item.targetIdHash, policyRevision: tombstone.policyRevision, reason: "active_tombstone" });
    else allowed.push(item);
  }
  return { allowed, blocked, readyForTraffic: blocked.length === 0 };
}

