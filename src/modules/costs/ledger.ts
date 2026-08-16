export const USAGE_KINDS = [
  "input",
  "cached_input",
  "cache_write",
  "output",
  "reasoning",
  "tool_call",
  "compute"
] as const;

export type UsageKind = (typeof USAGE_KINDS)[number];

export const COST_CLASSES = ["actual", "estimated", "simulated", "allocated", "infrastructure"] as const;
export type CostClass = (typeof COST_CLASSES)[number];

export interface UsageDimensions {
  workspaceId: string;
  projectId: string;
  taskId?: string;
  runId?: string;
  agentId?: string;
}

export interface UsageEvent extends UsageDimensions {
  sourceEventId: string;
  occurredAt: string;
  provider: string;
  model: string;
  kind: UsageKind;
  quantity: number;
  costClass: CostClass;
  compensatesEventId?: string;
}

export interface PriceEntry {
  id: string;
  provider: string;
  model: string;
  kind: UsageKind;
  effectiveFrom: string;
  effectiveUntil?: string;
  currency: string;
  /** Price in millionths of the currency per one million usage units. */
  microCurrencyPerMillionUnits: number;
  source: string;
  confidence: "authoritative" | "estimated";
}

export interface CostEntry extends UsageDimensions {
  usageEventId: string;
  priceEntryId?: string;
  currency: string;
  amountMicros: bigint;
  costClass: CostClass;
  confidence: "authoritative" | "estimated" | "simulated";
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
}

function canonicalUsage(event: UsageEvent): string {
  return JSON.stringify(Object.entries(event).sort(([left], [right]) => left.localeCompare(right)));
}

export class UsageLedger {
  readonly #events = new Map<string, UsageEvent>();
  readonly #fingerprints = new Map<string, string>();
  readonly #compensated = new Set<string>();

  ingest(event: UsageEvent): "inserted" | "duplicate" {
    assertInteger(event.quantity, "usage quantity");
    if (!event.sourceEventId || !event.workspaceId || !event.projectId) {
      throw new Error("Usage identity and workspace/project boundaries are required");
    }
    if (event.compensatesEventId) {
      const original = this.#events.get(event.compensatesEventId);
      if (!original) throw new Error("Compensated usage event does not exist");
      if (this.#compensated.has(original.sourceEventId)) throw new Error("Usage event was already compensated");
      if (event.quantity !== -original.quantity) throw new Error("Correction must exactly reverse original quantity");
      for (const key of ["workspaceId", "projectId", "taskId", "runId", "agentId", "kind", "provider", "model", "costClass"] as const) {
        if (event[key] !== original[key]) throw new Error(`Correction boundary mismatch: ${key}`);
      }
    } else if (event.quantity < 0) {
      throw new Error("Negative usage requires a compensatesEventId");
    }

    const fingerprint = canonicalUsage(event);
    const existing = this.#fingerprints.get(event.sourceEventId);
    if (existing) {
      if (existing !== fingerprint) throw new Error("Conflicting reuse of sourceEventId");
      return "duplicate";
    }

    this.#events.set(event.sourceEventId, Object.freeze({ ...event }));
    this.#fingerprints.set(event.sourceEventId, fingerprint);
    if (event.compensatesEventId) this.#compensated.add(event.compensatesEventId);
    return "inserted";
  }

  events(): readonly UsageEvent[] {
    return [...this.#events.values()];
  }
}

export function selectEffectivePrice(event: UsageEvent, catalog: readonly PriceEntry[]): PriceEntry | undefined {
  const occurredAt = Date.parse(event.occurredAt);
  const candidates = catalog.filter((price) =>
    price.provider === event.provider && price.model === event.model && price.kind === event.kind
    && Date.parse(price.effectiveFrom) <= occurredAt
    && (!price.effectiveUntil || occurredAt < Date.parse(price.effectiveUntil))
  ).sort((left, right) => Date.parse(right.effectiveFrom) - Date.parse(left.effectiveFrom));
  if (candidates.length > 1 && candidates[0].effectiveFrom === candidates[1].effectiveFrom) {
    throw new Error("Ambiguous effective price");
  }
  return candidates[0];
}

export function priceUsage(event: UsageEvent, catalog: readonly PriceEntry[]): CostEntry {
  const price = selectEffectivePrice(event, catalog);
  if (!price) throw new Error("No effective price for usage event");
  assertInteger(price.microCurrencyPerMillionUnits, "price");
  return {
    workspaceId: event.workspaceId,
    projectId: event.projectId,
    taskId: event.taskId,
    runId: event.runId,
    agentId: event.agentId,
    usageEventId: event.sourceEventId,
    priceEntryId: price.id,
    currency: price.currency,
    amountMicros: (BigInt(event.quantity) * BigInt(price.microCurrencyPerMillionUnits)) / 1_000_000n,
    costClass: event.costClass,
    confidence: event.costClass === "simulated" ? "simulated" : price.confidence
  };
}

export type CostGroup = "system" | "project" | "task" | "run" | "agent";

export interface CostTotal {
  groupKey: string;
  currency: string;
  costClass: CostClass;
  amountMicros: bigint;
}

export function aggregateCosts(entries: readonly CostEntry[], group: CostGroup): readonly CostTotal[] {
  const totals = new Map<string, CostTotal>();
  for (const entry of entries) {
    const groupKey = group === "system" ? entry.workspaceId : entry[`${group}Id` as keyof CostEntry];
    if (typeof groupKey !== "string") continue;
    const key = `${groupKey}\u0000${entry.currency}\u0000${entry.costClass}`;
    const current = totals.get(key);
    totals.set(key, {
      groupKey,
      currency: entry.currency,
      costClass: entry.costClass,
      amountMicros: (current?.amountMicros ?? 0n) + entry.amountMicros
    });
  }
  return [...totals.values()].sort((left, right) =>
    left.groupKey.localeCompare(right.groupKey) || left.currency.localeCompare(right.currency)
    || left.costClass.localeCompare(right.costClass)
  );
}

export interface PilotCostAggregate extends UsageDimensions {
  sourceId: string;
  occurredAt: string;
  amountMicros: number;
  currency: string;
  billed: boolean;
}

export function adaptPilotCost(source: PilotCostAggregate): CostEntry {
  assertInteger(source.amountMicros, "pilot amount");
  if (source.amountMicros < 0) throw new Error("Pilot aggregate cannot be negative");
  return {
    workspaceId: source.workspaceId,
    projectId: source.projectId,
    taskId: source.taskId,
    runId: source.runId,
    agentId: source.agentId,
    usageEventId: `pilot:${source.sourceId}`,
    currency: source.currency,
    amountMicros: BigInt(source.amountMicros),
    costClass: source.billed ? "actual" : "simulated",
    confidence: source.billed ? "authoritative" : "simulated"
  };
}

export interface BudgetEvidence {
  currency: string;
  remainingMicros: bigint;
  authoritative: boolean;
  observedAt: string;
}

export type BudgetAlert = "ok" | "warning" | "critical" | "unavailable";

export function evaluateBudget(evidence: BudgetEvidence | undefined, warningAtMicros: bigint): BudgetAlert {
  if (!evidence?.authoritative) return "unavailable";
  if (evidence.remainingMicros <= 0n) return "critical";
  if (evidence.remainingMicros <= warningAtMicros) return "warning";
  return "ok";
}

export function authorizePaidRoute(expectedCostMicros: bigint, evidence?: BudgetEvidence): void {
  if (expectedCostMicros <= 0n) return;
  if (!evidence?.authoritative) throw new Error("Paid route requires authoritative remaining-budget evidence");
  if (evidence.remainingMicros < expectedCostMicros) throw new Error("Insufficient remaining budget");
}
