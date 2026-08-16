import { describe, expect, it } from "vitest";
import { FixtureObservationProjection } from "./observation-ingestion";
import type { OrchestratorEvent } from "./contract";

const event = (sequence: number, type: string, payload: Record<string, unknown>, run = "fixture:run-1"): OrchestratorEvent => ({ eventId: `event-${run}-${sequence}`, deduplicationKey: `${run}:${sequence}`, workflowRunId: run, sequence, type, occurredAt: `2026-08-16T00:00:0${sequence}.000Z`, payload });

describe("fixture observation ingestion", () => {
  it("ingests identity, usage, tools, budget and terminal evidence without double counting", () => {
    const projection = new FixtureObservationProjection();
    const events = [
      event(1, "run.observed", { sessionId: "session-1", correlationId: "correlation-1", profile: "b-elanna", observedModel: "qwen3.8-max", billingMode: "token-plan" }),
      event(2, "usage.observed", { inputTokens: 120, outputTokens: 30 }),
      event(3, "tool.observed", { toolCallId: "tool-1" }),
      event(4, "budget.observed", { remainingUsd: 8.5, confidence: "authoritative" }),
      event(5, "run.terminal", { status: "succeeded" })
    ];
    for (const observed of events) expect(projection.ingest(observed)).toBe("applied");
    expect(projection.ingest(events[1])).toBe("duplicate");
    expect(projection.get("fixture:run-1")).toEqual({ workflowRunId: "fixture:run-1", lastSequence: 5, sessionId: "session-1", correlationId: "correlation-1", profile: "b-elanna", observedModel: "qwen3.8-max", billingMode: "token-plan", inputTokens: 120, outputTokens: 30, toolCallIds: ["tool-1"], remainingBudgetUsd: 8.5, budgetConfidence: "authoritative", terminalStatus: "succeeded", unknownOutcome: false });
  });

  it("reports gaps, rejects conflicting duplicates and preserves unknown terminal outcomes", () => {
    const projection = new FixtureObservationProjection();
    expect(projection.ingest(event(2, "usage.observed", { inputTokens: 1, outputTokens: 1 }))).toBe("gap");
    const terminal = event(1, "run.terminal", { status: "unknown" }, "fixture:unknown");
    expect(projection.ingest(terminal)).toBe("applied");
    expect(projection.get("fixture:unknown")).toMatchObject({ terminalStatus: "unknown", unknownOutcome: true });
    expect(() => projection.ingest({ ...terminal, payload: { status: "failed" } })).toThrow(/deduplication conflict/);
    expect(projection.ingest(event(1, "run.observed", { sessionId: "s", correlationId: "c", profile: "spock", observedModel: "gpt-5.6-sol", billingMode: "subscription" }))).toBe("applied");
    expect(() => projection.ingest({ ...event(1, "run.terminal", { status: "failed" }), deduplicationKey: "different-key" })).toThrow(/out of order/);
  });
});
