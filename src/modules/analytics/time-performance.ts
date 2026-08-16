import { sumIntervalDurations, unionIntervalDuration, type TimeInterval } from "../control-plane/metrics";

export const TRANSITION_TYPES = [
  "task_created",
  "task_ready",
  "run_started",
  "run_finished",
  "agent_active_started",
  "agent_active_ended",
  "task_blocked",
  "task_unblocked",
  "review_submitted",
  "task_accepted",
  "project_started",
  "project_completed"
] as const;

export type TransitionType = (typeof TRANSITION_TYPES)[number];
export type MetricCompleteness = "complete" | "partial" | "unavailable";
export type MetricConfidence = "authoritative" | "derived" | "partial";

export interface PersistedTransition {
  id: string;
  sequence: number;
  occurredAt: string;
  type: TransitionType;
  /** Pairs run/active/blocked interval boundaries without relying on array position. */
  intervalKey?: string;
}

export interface DerivedMetric {
  valueMs?: number;
  completeness: MetricCompleteness;
  confidence: MetricConfidence;
  provenance: readonly string[];
  missing: readonly string[];
}

export interface TimeMetricsReport {
  lead: DerivedMetric;
  queue: DerivedMetric;
  cycle: DerivedMetric;
  runWall: DerivedMetric;
  activeAgent: DerivedMetric;
  blocked: DerivedMetric;
  review: DerivedMetric;
  projectElapsed: DerivedMetric;
  /** Union of active intervals: calendar time with overlaps counted once. */
  activeCalendarElapsed: DerivedMetric;
  /** Sum of active intervals: parallel work remains additive. */
  agentHours: { value?: number } & Omit<DerivedMetric, "valueMs">;
}

function absent(...missing: string[]): DerivedMetric {
  return { completeness: "unavailable", confidence: "partial", provenance: [], missing };
}

function durationMetric(start: PersistedTransition | undefined, end: PersistedTransition | undefined): DerivedMetric {
  if (!start || !end) return absent(...[!start ? "start transition" : "", !end ? "end transition" : ""].filter(Boolean));
  const valueMs = Date.parse(end.occurredAt) - Date.parse(start.occurredAt);
  if (!Number.isFinite(valueMs) || valueMs < 0) throw new Error("Transition interval is invalid");
  return {
    valueMs,
    completeness: "complete",
    confidence: "derived",
    provenance: [start.id, end.id],
    missing: []
  };
}

function deriveIntervals(
  transitions: readonly PersistedTransition[],
  startType: TransitionType,
  endType: TransitionType
): { intervals: TimeInterval[]; provenance: string[]; open: string[] } {
  const starts = new Map<string, PersistedTransition>();
  const intervals: TimeInterval[] = [];
  const provenance: string[] = [];
  for (const transition of transitions) {
    if (transition.type !== startType && transition.type !== endType) continue;
    if (!transition.intervalKey) throw new Error(`${transition.type} requires intervalKey`);
    if (transition.type === startType) {
      if (starts.has(transition.intervalKey)) throw new Error(`Duplicate open interval: ${transition.intervalKey}`);
      starts.set(transition.intervalKey, transition);
      continue;
    }
    const start = starts.get(transition.intervalKey);
    if (!start) throw new Error(`Interval ended before it started: ${transition.intervalKey}`);
    const interval = { startedAt: new Date(start.occurredAt), endedAt: new Date(transition.occurredAt) };
    if (!Number.isFinite(interval.startedAt.getTime()) || !Number.isFinite(interval.endedAt.getTime())) {
      throw new Error("Transition timestamp is invalid");
    }
    intervals.push(interval);
    provenance.push(start.id, transition.id);
    starts.delete(transition.intervalKey);
  }
  return { intervals, provenance, open: [...starts.values()].map((transition) => transition.id) };
}

function intervalsMetric(result: ReturnType<typeof deriveIntervals>, union = false): DerivedMetric {
  if (result.intervals.length === 0) {
    return result.open.length > 0
      ? { completeness: "partial", confidence: "partial", provenance: result.open, missing: ["closing transition"] }
      : absent("interval transitions");
  }
  return {
    valueMs: union ? unionIntervalDuration(result.intervals) : sumIntervalDurations(result.intervals),
    completeness: result.open.length ? "partial" : "complete",
    confidence: result.open.length ? "partial" : "derived",
    provenance: [...result.provenance, ...result.open],
    missing: result.open.length ? ["closing transition"] : []
  };
}

export function deriveTimeMetrics(input: readonly PersistedTransition[]): TimeMetricsReport {
  const transitions = [...input].sort((left, right) => left.sequence - right.sequence);
  const seen = new Set<string>();
  for (const [index, transition] of transitions.entries()) {
    if (seen.has(transition.id)) throw new Error(`Duplicate transition id: ${transition.id}`);
    if (!Number.isSafeInteger(transition.sequence) || (index > 0 && transition.sequence <= transitions[index - 1].sequence)) {
      throw new Error("Transition sequence must be unique and strictly increasing");
    }
    seen.add(transition.id);
  }
  const first = (type: TransitionType) => transitions.find((transition) => transition.type === type);
  const runIntervals = deriveIntervals(transitions, "run_started", "run_finished");
  const activeIntervals = deriveIntervals(transitions, "agent_active_started", "agent_active_ended");
  const blockedIntervals = deriveIntervals(transitions, "task_blocked", "task_unblocked");
  const activeAgent = intervalsMetric(activeIntervals);
  return {
    lead: durationMetric(first("task_created"), first("task_accepted")),
    queue: durationMetric(first("task_ready"), first("run_started")),
    cycle: durationMetric(first("run_started"), first("task_accepted")),
    runWall: intervalsMetric(runIntervals),
    activeAgent,
    blocked: intervalsMetric(blockedIntervals),
    review: durationMetric(first("review_submitted"), first("task_accepted")),
    projectElapsed: durationMetric(first("project_started"), first("project_completed")),
    activeCalendarElapsed: intervalsMetric(activeIntervals, true),
    agentHours: {
      value: activeAgent.valueMs === undefined ? undefined : activeAgent.valueMs / 3_600_000,
      completeness: activeAgent.completeness,
      confidence: activeAgent.confidence,
      provenance: activeAgent.provenance,
      missing: activeAgent.missing
    }
  };
}

export type ReportScope = "portfolio" | "project" | "agent";

export interface PerformanceRecord {
  taskId: string;
  projectId: string;
  agentId: string;
  accepted: boolean;
  attempts: number;
  retries: number;
  reworkCount: number;
  costMicros?: bigint;
  currency?: string;
  provenance: readonly string[];
}

export interface PerformanceAggregate {
  scopeKey: string;
  throughput: number;
  firstAttemptSuccessRate?: number;
  retries: number;
  rework: number;
  costPerAcceptedTask: readonly { currency: string; amountMicros: bigint }[];
  completeness: MetricCompleteness;
  provenance: readonly string[];
}

export function buildPerformanceReport(records: readonly PerformanceRecord[], scope: ReportScope): readonly PerformanceAggregate[] {
  const groups = new Map<string, PerformanceRecord[]>();
  for (const record of records) {
    const key = scope === "portfolio" ? "portfolio" : scope === "project" ? record.projectId : record.agentId;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([scopeKey, rows]) => {
    const accepted = rows.filter((row) => row.accepted);
    const firstAttempt = accepted.filter((row) => row.attempts === 1).length;
    const currencyTotals = new Map<string, bigint>();
    let costsComplete = true;
    for (const row of accepted) {
      if (row.costMicros === undefined || !row.currency) {
        costsComplete = false;
        continue;
      }
      currencyTotals.set(row.currency, (currencyTotals.get(row.currency) ?? 0n) + row.costMicros);
    }
    return {
      scopeKey,
      throughput: accepted.length,
      firstAttemptSuccessRate: accepted.length ? firstAttempt / accepted.length : undefined,
      retries: rows.reduce((total, row) => total + row.retries, 0),
      rework: rows.reduce((total, row) => total + row.reworkCount, 0),
      costPerAcceptedTask: costsComplete ? [...currencyTotals.entries()].map(([currency, total]) => ({
        currency,
        amountMicros: total / BigInt(accepted.length)
      })) : [],
      completeness: accepted.length === 0 || !costsComplete ? "partial" : "complete",
      provenance: [...new Set(rows.flatMap((row) => row.provenance))]
    };
  });
}
