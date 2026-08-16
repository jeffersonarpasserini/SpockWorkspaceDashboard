export type MetricState = "healthy" | "degraded" | "unavailable";

export interface OperationalHealthInput {
  observedAt: string;
  databaseReachable: boolean;
  schemaReady: boolean;
  workerHeartbeatAt?: string;
  workerHeartbeatMaxAgeMs: number;
  oldestQueuedAt?: string;
  reconciliation: {
    lastCompletedAt?: string;
    pending: number;
    failures: number;
  };
  deadLetterCount: number;
}

export interface OperationalMetric<T> {
  state: MetricState;
  value?: T;
  reason: string;
}

export interface OperationalHealthSnapshot {
  /** Liveness proves only that the web process can answer. */
  liveness: { alive: true };
  readiness: { ready: boolean; blockers: readonly string[] };
  database: OperationalMetric<boolean>;
  migrations: OperationalMetric<boolean>;
  workerHeartbeat: OperationalMetric<{ ageMs: number; observedAt: string }>;
  queueLag: OperationalMetric<number>;
  reconciliation: OperationalMetric<{ pending: number; failures: number; lastCompletedAt?: string }>;
  deadLetters: OperationalMetric<number>;
}

function nonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function ageMs(now: number, timestamp: string, label: string): number {
  const observed = Date.parse(timestamp);
  if (!Number.isFinite(observed) || observed > now) throw new Error(`${label} timestamp is invalid`);
  return now - observed;
}

export function evaluateOperationalHealth(input: OperationalHealthInput): OperationalHealthSnapshot {
  const now = Date.parse(input.observedAt);
  if (!Number.isFinite(now)) throw new Error("Operational observation timestamp is invalid");
  nonNegativeInteger(input.workerHeartbeatMaxAgeMs, "heartbeat max age");
  nonNegativeInteger(input.reconciliation.pending, "reconciliation pending");
  nonNegativeInteger(input.reconciliation.failures, "reconciliation failures");
  nonNegativeInteger(input.deadLetterCount, "dead-letter count");

  const database: OperationalMetric<boolean> = input.databaseReachable
    ? { state: "healthy", value: true, reason: "database probe succeeded" }
    : { state: "unavailable", value: false, reason: "database probe failed" };
  const migrations: OperationalMetric<boolean> = input.schemaReady
    ? { state: "healthy", value: true, reason: "required migrations installed" }
    : { state: "unavailable", value: false, reason: "schema is not ready" };

  let workerHeartbeat: OperationalHealthSnapshot["workerHeartbeat"];
  if (!input.workerHeartbeatAt) {
    workerHeartbeat = { state: "unavailable", reason: "worker heartbeat has not been observed" };
  } else {
    const age = ageMs(now, input.workerHeartbeatAt, "heartbeat");
    workerHeartbeat = {
      state: age <= input.workerHeartbeatMaxAgeMs ? "healthy" : "degraded",
      value: { ageMs: age, observedAt: input.workerHeartbeatAt },
      reason: age <= input.workerHeartbeatMaxAgeMs ? "worker heartbeat is current" : "worker heartbeat is stale"
    };
  }

  const queueLag: OperationalMetric<number> = input.oldestQueuedAt
    ? { state: "healthy", value: ageMs(now, input.oldestQueuedAt, "oldest queued job"), reason: "derived from oldest queued job" }
    : { state: "unavailable", reason: "queue is empty or has not been observed" };
  const reconciliation: OperationalHealthSnapshot["reconciliation"] = {
    state: input.reconciliation.failures > 0 ? "degraded" : input.reconciliation.lastCompletedAt ? "healthy" : "unavailable",
    value: { ...input.reconciliation },
    reason: input.reconciliation.failures > 0 ? "reconciliation failures require attention"
      : input.reconciliation.lastCompletedAt ? "reconciliation completed" : "reconciliation has not completed"
  };
  const deadLetters: OperationalMetric<number> = {
    state: input.deadLetterCount > 0 ? "degraded" : "healthy",
    value: input.deadLetterCount,
    reason: input.deadLetterCount > 0 ? "dead-letter jobs require attention" : "no dead-letter jobs"
  };
  const blockers = [
    !input.databaseReachable ? "database" : "",
    !input.schemaReady ? "migrations" : "",
    workerHeartbeat.state !== "healthy" ? "worker heartbeat" : "",
    reconciliation.state === "degraded" ? "reconciliation" : "",
    deadLetters.state === "degraded" ? "dead letters" : ""
  ].filter(Boolean);
  return Object.freeze({
    liveness: Object.freeze({ alive: true as const }),
    readiness: Object.freeze({ ready: blockers.length === 0, blockers: Object.freeze(blockers) }),
    database: Object.freeze(database),
    migrations: Object.freeze(migrations),
    workerHeartbeat: Object.freeze(workerHeartbeat),
    queueLag: Object.freeze(queueLag),
    reconciliation: Object.freeze(reconciliation),
    deadLetters: Object.freeze(deadLetters)
  });
}
