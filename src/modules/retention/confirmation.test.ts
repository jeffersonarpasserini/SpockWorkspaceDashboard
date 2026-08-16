import { describe, expect, it, vi } from "vitest";
import { evaluateDryRunClaim, UnsupportedRetentionConfirmationAdapter, type DryRunClaimStore, type RetentionConfirmationAdapter } from "./confirmation";
import type { ClaimedRetentionItem } from "./plan-repository";

const claim = (dataClass: ClaimedRetentionItem["dataClass"]): ClaimedRetentionItem => ({ id: "10000000-0000-4000-8000-000000000001", planId: "10000000-0000-4000-8000-000000000002", dataClass, targetIdHash: "a".repeat(64), decision: "purge_due", attempts: 1, claimedBy: "worker-1", claimedUntil: new Date("2026-08-15T01:00:00Z") });

function store() {
  return { finishDryRunClaim: vi.fn().mockResolvedValue(undefined), deferDryRunClaim: vi.fn().mockResolvedValue(undefined) } satisfies DryRunClaimStore;
}

describe("retention dry-run confirmation", () => {
  it("confirms owned analysis without invoking an external adapter", async () => {
    const target = store();
    await evaluateDryRunClaim({ claim: claim("domain_events"), workerId: "worker-1", store: target });
    expect(target.finishDryRunClaim).toHaveBeenCalledWith(expect.any(String), "worker-1", "confirmed");
  });

  it("defaults external authorities to unsupported instead of claiming success", async () => {
    const target = store();
    expect(await new UnsupportedRetentionConfirmationAdapter().confirm()).toEqual({ state: "unsupported" });
    await evaluateDryRunClaim({ claim: claim("sessions"), workerId: "worker-1", store: target });
    expect(target.finishDryRunClaim).toHaveBeenCalledWith(expect.any(String), "worker-1", "unsupported");
  });

  it("defers pending adapters and records only their bounded error class on failure", async () => {
    const pendingStore = store();
    const pending: RetentionConfirmationAdapter = { confirm: vi.fn().mockResolvedValue({ state: "pending", retryAfterMs: 10_000 }) };
    await evaluateDryRunClaim({ claim: claim("sessions"), workerId: "worker-1", store: pendingStore, adapters: { sessions: pending } });
    expect(pendingStore.deferDryRunClaim).toHaveBeenCalledWith(expect.any(String), "worker-1", 10_000);

    const failedStore = store();
    const failed: RetentionConfirmationAdapter = { confirm: vi.fn().mockResolvedValue({ state: "failed", errorClass: "Remote timeout: token=secret" }) };
    await evaluateDryRunClaim({ claim: claim("sessions"), workerId: "worker-1", store: failedStore, adapters: { sessions: failed } });
    expect(failedStore.finishDryRunClaim).toHaveBeenCalledWith(expect.any(String), "worker-1", "failed", "Remote timeout: token=secret");
  });
});

