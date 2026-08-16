import { RETENTION_MATRIX, type RuntimeDataClass } from "./policy";
import type { ClaimedRetentionItem, RetentionClaimOutcome } from "./plan-repository";

export type ExternalConfirmationResult =
  | { state: "confirmed" }
  | { state: "pending"; retryAfterMs: number }
  | { state: "unsupported" }
  | { state: "failed"; errorClass: string };

export interface RetentionConfirmationAdapter {
  confirm(input: { dataClass: RuntimeDataClass; targetIdHash: string }): Promise<ExternalConfirmationResult>;
}

export interface DryRunClaimStore {
  finishDryRunClaim(itemId: string, workerId: string, outcome: RetentionClaimOutcome, errorClass?: string): Promise<void>;
  deferDryRunClaim(itemId: string, workerId: string, retryAfterMs: number): Promise<void>;
}

export class UnsupportedRetentionConfirmationAdapter implements RetentionConfirmationAdapter {
  async confirm(): Promise<ExternalConfirmationResult> {
    return { state: "unsupported" };
  }
}

export async function evaluateDryRunClaim(input: {
  claim: ClaimedRetentionItem;
  workerId: string;
  store: DryRunClaimStore;
  adapters?: Partial<Record<RuntimeDataClass, RetentionConfirmationAdapter>>;
}): Promise<void> {
  const rule = RETENTION_MATRIX.find(({ dataClass }) => dataClass === input.claim.dataClass);
  if (!rule) throw new Error("retention claim references an unknown data class");
  if (rule.confirmation === "owned") {
    await input.store.finishDryRunClaim(input.claim.id, input.workerId, "confirmed");
    return;
  }
  const adapter = input.adapters?.[input.claim.dataClass] ?? new UnsupportedRetentionConfirmationAdapter();
  const result = await adapter.confirm({ dataClass: input.claim.dataClass, targetIdHash: input.claim.targetIdHash });
  if (result.state === "pending") {
    await input.store.deferDryRunClaim(input.claim.id, input.workerId, result.retryAfterMs);
  } else if (result.state === "failed") {
    await input.store.finishDryRunClaim(input.claim.id, input.workerId, "failed", result.errorClass);
  } else {
    await input.store.finishDryRunClaim(input.claim.id, input.workerId, result.state);
  }
}

