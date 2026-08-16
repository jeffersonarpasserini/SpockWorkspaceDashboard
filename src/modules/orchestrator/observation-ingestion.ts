import type { OrchestratorEvent } from "./contract";

export interface ObservedRunProjection {
  workflowRunId: string;
  lastSequence: number;
  sessionId: string | null;
  correlationId: string | null;
  profile: string | null;
  observedModel: string | null;
  billingMode: "subscription" | "token-plan" | "prepaid-reserve" | null;
  inputTokens: number;
  outputTokens: number;
  toolCallIds: readonly string[];
  remainingBudgetUsd: number | null;
  budgetConfidence: "authoritative" | "estimated" | "unavailable";
  terminalStatus: string | null;
  unknownOutcome: boolean;
}

export type IngestionResult = "applied" | "duplicate" | "gap";

const textField = (payload: Readonly<Record<string, unknown>>, key: string): string => {
  const value = payload[key];
  if (typeof value !== "string" || !value || value.length > 256) throw new Error(`invalid orchestrator ${key}`);
  return value;
};

const countField = (payload: Readonly<Record<string, unknown>>, key: string): number => {
  const value = payload[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`invalid orchestrator ${key}`);
  return value as number;
};

export class FixtureObservationProjection {
  private readonly runs = new Map<string, ObservedRunProjection>();
  private readonly deduplication = new Map<string, string>();

  ingest(event: OrchestratorEvent): IngestionResult {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error("invalid orchestrator event sequence");
    if (!event.eventId || !event.deduplicationKey || !event.workflowRunId) throw new Error("orchestrator event identity is required");
    const fingerprint = JSON.stringify(event);
    const prior = this.deduplication.get(event.deduplicationKey);
    if (prior) {
      if (prior !== fingerprint) throw new Error("orchestrator deduplication conflict");
      return "duplicate";
    }
    const current = this.runs.get(event.workflowRunId) ?? this.empty(event.workflowRunId);
    if (event.sequence > current.lastSequence + 1) return "gap";
    if (event.sequence <= current.lastSequence) throw new Error("orchestrator event is out of order without a matching deduplication key");
    const next: ObservedRunProjection = { ...current, toolCallIds: [...current.toolCallIds], lastSequence: event.sequence };
    switch (event.type) {
      case "run.observed": {
        next.sessionId = textField(event.payload, "sessionId");
        next.correlationId = textField(event.payload, "correlationId");
        next.profile = textField(event.payload, "profile");
        next.observedModel = textField(event.payload, "observedModel");
        const billingMode = textField(event.payload, "billingMode");
        if (!["subscription", "token-plan", "prepaid-reserve"].includes(billingMode)) throw new Error("invalid orchestrator billingMode");
        next.billingMode = billingMode as ObservedRunProjection["billingMode"];
        break;
      }
      case "usage.observed":
        next.inputTokens += countField(event.payload, "inputTokens");
        next.outputTokens += countField(event.payload, "outputTokens");
        break;
      case "tool.observed": {
        const toolCallId = textField(event.payload, "toolCallId");
        if (!next.toolCallIds.includes(toolCallId)) next.toolCallIds = [...next.toolCallIds, toolCallId];
        break;
      }
      case "budget.observed": {
        const remaining = event.payload.remainingUsd;
        if (typeof remaining !== "number" || !Number.isFinite(remaining) || remaining < 0) throw new Error("invalid orchestrator remainingUsd");
        const confidence = textField(event.payload, "confidence");
        if (!["authoritative", "estimated", "unavailable"].includes(confidence)) throw new Error("invalid orchestrator budget confidence");
        next.remainingBudgetUsd = remaining;
        next.budgetConfidence = confidence as ObservedRunProjection["budgetConfidence"];
        break;
      }
      case "run.terminal":
        next.terminalStatus = textField(event.payload, "status");
        next.unknownOutcome = next.sessionId === null;
        break;
      default:
        throw new Error(`unsupported orchestrator fixture event type: ${event.type}`);
    }
    this.deduplication.set(event.deduplicationKey, fingerprint);
    this.runs.set(event.workflowRunId, next);
    return "applied";
  }

  get(workflowRunId: string): ObservedRunProjection | null {
    const projection = this.runs.get(workflowRunId);
    return projection ? structuredClone(projection) : null;
  }

  private empty(workflowRunId: string): ObservedRunProjection {
    return { workflowRunId, lastSequence: 0, sessionId: null, correlationId: null, profile: null, observedModel: null, billingMode: null, inputTokens: 0, outputTokens: 0, toolCallIds: [], remainingBudgetUsd: null, budgetConfidence: "unavailable", terminalStatus: null, unknownOutcome: false };
  }
}

