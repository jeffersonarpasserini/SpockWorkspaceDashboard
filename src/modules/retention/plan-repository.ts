import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { planRetention, RETENTION_MATRIX, type RetentionHold, type RuntimeDataClass } from "./policy";

const KEY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const WORKER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export interface RetentionCandidate {
  dataClass: RuntimeDataClass;
  targetId: string;
  clockStartedAt: Date;
  holds?: readonly RetentionHold[];
}

export interface DryRunPlanItem {
  id: string;
  dataClass: RuntimeDataClass;
  targetIdHash: string;
  decision: "active" | "expired" | "tombstoned" | "purge_due" | "held";
  confirmationState: "pending" | "not_required";
}

export interface DryRunPlan {
  id: string;
  workspaceId: string;
  idempotencyKey: string;
  policyRevisionSetHash: string;
  dryRun: 1;
  plannedAt: Date;
  items: readonly DryRunPlanItem[];
}

export interface ClaimedRetentionItem {
  id: string;
  planId: string;
  dataClass: RuntimeDataClass;
  targetIdHash: string;
  decision: DryRunPlanItem["decision"];
  attempts: number;
  claimedBy: string;
  claimedUntil: Date;
}

export type RetentionClaimOutcome = "confirmed" | "unsupported" | "failed";

export function sanitizeRetentionErrorClass(value: string): string {
  return /^[a-z][a-z0-9_.-]{0,63}$/.test(value) ? value : "retention_adapter_error";
}

export function buildDryRunPlan(input: {
  workspaceId: string;
  idempotencyKey: string;
  candidates: readonly RetentionCandidate[];
  plannedAt: Date;
  targetHashKey: string;
}): DryRunPlan {
  if (!KEY.test(input.idempotencyKey)) throw new Error("invalid retention idempotency key");
  if (!input.targetHashKey || input.targetHashKey.length < 32) throw new Error("retention target hash key must contain at least 32 characters");
  if (input.candidates.length < 1 || input.candidates.length > 1_000) throw new Error("retention dry-run requires 1 to 1000 candidates");
  if (Number.isNaN(input.plannedAt.getTime())) throw new Error("plannedAt must be valid");
  const policyRevisionSetHash = createHash("sha256").update(JSON.stringify(RETENTION_MATRIX.map(({ dataClass, revision }) => [dataClass, revision]))).digest("hex");
  const seen = new Set<string>();
  const items = input.candidates.map((candidate) => {
    if (!candidate.targetId) throw new Error("retention target id must not be blank");
    const targetIdHash = createHmac("sha256", input.targetHashKey).update(`${input.workspaceId}\0${candidate.dataClass}\0${candidate.targetId}`).digest("hex");
    const identity = `${candidate.dataClass}:${targetIdHash}`;
    if (seen.has(identity)) throw new Error("duplicate retention candidate");
    seen.add(identity);
    const rule = RETENTION_MATRIX.find(({ dataClass }) => dataClass === candidate.dataClass)!;
    const decision = planRetention(rule, candidate.clockStartedAt, input.plannedAt, candidate.holds);
    return {
      id: randomUUID(),
      dataClass: candidate.dataClass,
      targetIdHash,
      decision: decision.state,
      confirmationState: decision.requiresExternalConfirmation ? "pending" as const : "not_required" as const
    };
  });
  return { id: randomUUID(), workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey, policyRevisionSetHash, dryRun: 1, plannedAt: input.plannedAt, items };
}

export class RetentionPlanRepository {
  constructor(private readonly client: Sql) {}

  async createDryRun(plan: DryRunPlan): Promise<string> {
    return this.client.begin(async (tx) => {
      await tx`
        INSERT INTO spock.retention_plans
          (id, workspace_id, idempotency_key, policy_revision_set_hash, dry_run, planned_at)
        VALUES (${plan.id}, ${plan.workspaceId}, ${plan.idempotencyKey}, ${plan.policyRevisionSetHash}, 1, ${plan.plannedAt.toISOString()}::timestamptz)
        ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
      `;
      const existing = await tx<{ id: string; policyRevisionSetHash: string; dryRun: number }[]>`
        SELECT id, policy_revision_set_hash AS "policyRevisionSetHash", dry_run AS "dryRun"
        FROM spock.retention_plans
        WHERE workspace_id = ${plan.workspaceId} AND idempotency_key = ${plan.idempotencyKey}
      `;
      const persisted = existing[0];
      if (!persisted || persisted.policyRevisionSetHash !== plan.policyRevisionSetHash || persisted.dryRun !== 1) {
        throw new Error("retention idempotency key conflicts with another plan");
      }
      if (persisted.id !== plan.id) return persisted.id;
      for (const item of plan.items) {
        await tx`
          INSERT INTO spock.retention_plan_items
            (id, plan_id, data_class, target_id_hash, decision, confirmation_state)
          VALUES (${item.id}, ${plan.id}, ${item.dataClass}, ${item.targetIdHash}, ${item.decision}, ${item.confirmationState})
          ON CONFLICT (plan_id, data_class, target_id_hash) DO NOTHING
        `;
      }
      return persisted.id;
    });
  }

  async claimNextDryRun(workerId: string, leaseMs = 30_000): Promise<ClaimedRetentionItem | null> {
    if (!WORKER.test(workerId)) throw new Error("invalid retention worker id");
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 900_000) throw new Error("invalid retention lease");
    const rows = await this.client<ClaimedRetentionItem[]>`
      WITH candidate AS (
        SELECT item.id
        FROM spock.retention_plan_items item
        JOIN spock.retention_plans plan ON plan.id = item.plan_id
        WHERE plan.dry_run = 1
          AND plan.status IN ('planned', 'running')
          AND item.decision <> 'active'
          AND item.attempts < 5
          AND (item.claimed_until IS NULL OR item.claimed_until <= clock_timestamp())
          AND item.confirmation_state IN ('pending', 'not_required', 'failed')
        ORDER BY item.created_at, item.id
        FOR UPDATE OF item SKIP LOCKED
        LIMIT 1
      )
      UPDATE spock.retention_plan_items item
      SET claimed_by = ${workerId},
          claimed_until = clock_timestamp() + ${leaseMs} * interval '1 millisecond',
          attempts = item.attempts + 1,
          updated_at = clock_timestamp()
      FROM candidate
      WHERE item.id = candidate.id
      RETURNING item.id,
                item.plan_id AS "planId",
                item.data_class AS "dataClass",
                item.target_id_hash AS "targetIdHash",
                item.decision,
                item.attempts,
                item.claimed_by AS "claimedBy",
                item.claimed_until AS "claimedUntil"
    `;
    return rows[0] ?? null;
  }

  async finishDryRunClaim(itemId: string, workerId: string, outcome: RetentionClaimOutcome, errorClass?: string): Promise<void> {
    if (!WORKER.test(workerId)) throw new Error("invalid retention worker id");
    if (!/^[0-9a-f-]{36}$/.test(itemId)) throw new Error("invalid retention item id");
    if (outcome === "failed" && !errorClass) throw new Error("failed retention claims require a sanitized error class");
    if (outcome !== "failed" && errorClass) throw new Error("successful retention claims cannot include an error class");
    const sanitizedErrorClass = errorClass ? sanitizeRetentionErrorClass(errorClass) : null;
    const rows = await this.client`
      UPDATE spock.retention_plan_items item
      SET confirmation_state = ${outcome},
          claimed_by = NULL,
          claimed_until = NULL,
          sanitized_error_class = ${sanitizedErrorClass},
          updated_at = clock_timestamp()
      FROM spock.retention_plans plan
      WHERE item.id = ${itemId}
        AND plan.id = item.plan_id
        AND plan.dry_run = 1
        AND item.claimed_by = ${workerId}
        AND item.claimed_until > clock_timestamp()
      RETURNING item.id
    `;
    if (rows.length !== 1) throw new Error("retention claim is missing, expired or owned by another worker");
  }

  async deferDryRunClaim(itemId: string, workerId: string, retryAfterMs: number): Promise<void> {
    if (!WORKER.test(workerId)) throw new Error("invalid retention worker id");
    if (!/^[0-9a-f-]{36}$/.test(itemId)) throw new Error("invalid retention item id");
    if (!Number.isSafeInteger(retryAfterMs) || retryAfterMs < 1_000 || retryAfterMs > 900_000) throw new Error("invalid retention retry delay");
    const rows = await this.client`
      UPDATE spock.retention_plan_items item
      SET claimed_until = clock_timestamp() + ${retryAfterMs} * interval '1 millisecond',
          updated_at = clock_timestamp()
      FROM spock.retention_plans plan
      WHERE item.id = ${itemId}
        AND plan.id = item.plan_id
        AND plan.dry_run = 1
        AND item.confirmation_state = 'pending'
        AND item.claimed_by = ${workerId}
        AND item.claimed_until > clock_timestamp()
      RETURNING item.id
    `;
    if (rows.length !== 1) throw new Error("retention claim cannot be deferred");
  }
}
