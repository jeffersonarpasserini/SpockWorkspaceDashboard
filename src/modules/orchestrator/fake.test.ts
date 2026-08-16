import { describe, expect, it } from "vitest";
import { FakeOrchestratorAdapter, IntegrationHoldError } from "./fake";

const command = {
  requestId: "req-1",
  projectId: "project-1",
  taskId: "task-1",
  workflowVersion: "feature@1",
  profile: "b-elanna",
  objective: "Implement the fixture-backed slice"
};

describe("FakeOrchestratorAdapter", () => {
  it("blocks submission by default while the integration hold is active", async () => {
    const adapter = new FakeOrchestratorAdapter();
    await expect(adapter.health()).resolves.toEqual({ contractVersion: "fixture-v1", status: "available" });
    await expect(adapter.submit(command)).rejects.toBeInstanceOf(IntegrationHoldError);
    expect(adapter.submitted).toEqual([]);
  });

  it("allows deterministic fixture-only submission when a test opts in", async () => {
    const adapter = new FakeOrchestratorAdapter([
      { name: "feature-workflow", state: "planned", contractVersion: "fixture-v1" }
    ], true);
    await expect(adapter.submit(command)).resolves.toEqual({
      workflowRunId: "fixture:req-1",
      requestId: "req-1",
      status: "queued"
    });
    expect(await adapter.capabilities()).toEqual([
      { name: "feature-workflow", state: "planned", contractVersion: "fixture-v1" }
    ]);
    await expect(adapter.submit(command)).resolves.toMatchObject({ workflowRunId: "fixture:req-1" });
    expect(adapter.submitted).toHaveLength(1);
  });

  it("returns fixture status and bounded sequenced event pages", async () => {
    const statuses = [{ workflowRunId: "fixture:req-1", requestId: "req-1", status: "running" as const, lastSequence: 2 }];
    const events = [
      { eventId: "event-2", deduplicationKey: "run:2", workflowRunId: "fixture:req-1", sequence: 2, type: "run.started", occurredAt: "2026-08-16T00:00:02Z", payload: {} },
      { eventId: "event-1", deduplicationKey: "run:1", workflowRunId: "fixture:req-1", sequence: 1, type: "run.queued", occurredAt: "2026-08-16T00:00:01Z", payload: {} }
    ];
    const adapter = new FakeOrchestratorAdapter([], false, statuses, events);
    await expect(adapter.status("fixture:req-1")).resolves.toEqual(statuses[0]);
    await expect(adapter.status("missing")).resolves.toBeNull();
    await expect(adapter.events(0, 1)).resolves.toMatchObject({ events: [{ sequence: 1 }], nextCursor: 1 });
    await expect(adapter.events(1)).resolves.toMatchObject({ events: [{ sequence: 2 }], nextCursor: 2 });
    await expect(adapter.events(-1)).rejects.toThrow(/cursor/);
  });
});
