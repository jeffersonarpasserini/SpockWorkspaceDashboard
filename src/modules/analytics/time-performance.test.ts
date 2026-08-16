import { describe, expect, it } from "vitest";
import { buildPerformanceReport, deriveTimeMetrics, type PersistedTransition } from "./time-performance";

const transition = (sequence: number, type: PersistedTransition["type"], hour: number, intervalKey?: string): PersistedTransition => ({
  id: `event-${sequence}`,
  sequence,
  type,
  occurredAt: `2026-08-16T${String(hour).padStart(2, "0")}:00:00.000Z`,
  intervalKey
});

describe("time and performance analytics", () => {
  it("derives every fixed metric from append-only transitions with provenance", () => {
    const report = deriveTimeMetrics([
      transition(1, "project_started", 8), transition(2, "task_created", 9), transition(3, "task_ready", 10),
      transition(4, "run_started", 11, "run-1"), transition(5, "agent_active_started", 11, "agent-1"),
      transition(6, "agent_active_started", 11, "agent-2"), transition(7, "task_blocked", 12, "blocked-1"),
      transition(8, "task_unblocked", 13, "blocked-1"), transition(9, "agent_active_ended", 12, "agent-1"),
      transition(10, "agent_active_ended", 12, "agent-2"), transition(11, "run_finished", 14, "run-1"),
      transition(12, "review_submitted", 14), transition(13, "task_accepted", 15),
      transition(14, "project_completed", 16)
    ]);
    expect(report.lead.valueMs).toBe(6 * 3_600_000);
    expect(report.queue.valueMs).toBe(3_600_000);
    expect(report.cycle.valueMs).toBe(4 * 3_600_000);
    expect(report.runWall.valueMs).toBe(3 * 3_600_000);
    expect(report.blocked.valueMs).toBe(3_600_000);
    expect(report.review.valueMs).toBe(3_600_000);
    expect(report.projectElapsed.valueMs).toBe(8 * 3_600_000);
    expect(report.activeAgent.valueMs).toBe(2 * 3_600_000);
    expect(report.activeCalendarElapsed.valueMs).toBe(3_600_000);
    expect(report.agentHours.value).toBe(2);
    expect(report.lead).toMatchObject({ completeness: "complete", confidence: "derived", provenance: ["event-2", "event-13"] });
  });

  it("marks open and acceptance-dependent metrics partial or unavailable without using current time or zero", () => {
    const report = deriveTimeMetrics([
      transition(1, "task_created", 9), transition(2, "task_ready", 10),
      transition(3, "run_started", 11, "run-1"), transition(4, "agent_active_started", 11, "agent-1")
    ]);
    expect(report.lead).toMatchObject({ completeness: "unavailable" });
    expect(report.lead).not.toHaveProperty("valueMs");
    expect(report.cycle).toMatchObject({ completeness: "unavailable" });
    expect(report.cycle).not.toHaveProperty("valueMs");
    expect(report.runWall).toMatchObject({ completeness: "partial" });
    expect(report.runWall).not.toHaveProperty("valueMs");
    expect(report.activeAgent).toMatchObject({ completeness: "partial" });
    expect(report.activeAgent).not.toHaveProperty("valueMs");
    expect(report.agentHours).toMatchObject({ value: undefined, completeness: "partial" });
  });

  it("rejects broken transition histories", () => {
    expect(() => deriveTimeMetrics([transition(1, "run_finished", 10, "run-1")])).toThrow("ended before");
    expect(() => deriveTimeMetrics([transition(1, "task_created", 10), { ...transition(2, "task_ready", 11), id: "event-1" }])).toThrow("Duplicate transition");
  });

  it("builds attributable portfolio, project and agent performance reports", () => {
    const records = [
      { taskId: "t1", projectId: "p1", agentId: "a1", accepted: true, attempts: 1, retries: 0, reworkCount: 0, costMicros: 100n, currency: "USD", provenance: ["run-1"] },
      { taskId: "t2", projectId: "p1", agentId: "a2", accepted: true, attempts: 2, retries: 1, reworkCount: 1, costMicros: 300n, currency: "USD", provenance: ["run-2"] },
      { taskId: "t3", projectId: "p2", agentId: "a1", accepted: false, attempts: 1, retries: 0, reworkCount: 0, provenance: ["run-3"] }
    ];
    expect(buildPerformanceReport(records, "portfolio")).toEqual([expect.objectContaining({
      scopeKey: "portfolio", throughput: 2, firstAttemptSuccessRate: 0.5, retries: 1, rework: 1,
      costPerAcceptedTask: [{ currency: "USD", amountMicros: 200n }], completeness: "complete",
      provenance: ["run-1", "run-2", "run-3"]
    })]);
    expect(buildPerformanceReport(records, "project")).toHaveLength(2);
    expect(buildPerformanceReport(records, "agent")).toHaveLength(2);
  });

  it("does not invent rate or cost-per-accepted-task when acceptance or costs are absent", () => {
    const report = buildPerformanceReport([{
      taskId: "t1", projectId: "p1", agentId: "a1", accepted: false, attempts: 1,
      retries: 0, reworkCount: 0, provenance: ["run-1"]
    }], "project")[0];
    expect(report).toMatchObject({ throughput: 0, firstAttemptSuccessRate: undefined, costPerAcceptedTask: [], completeness: "partial" });
    const missingCost = buildPerformanceReport([{
      taskId: "t2", projectId: "p1", agentId: "a1", accepted: true, attempts: 1,
      retries: 0, reworkCount: 0, provenance: ["run-2"]
    }], "project")[0];
    expect(missingCost).toMatchObject({ throughput: 1, costPerAcceptedTask: [], completeness: "partial" });
  });
});
