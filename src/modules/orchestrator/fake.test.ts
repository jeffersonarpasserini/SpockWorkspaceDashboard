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
  });
});
