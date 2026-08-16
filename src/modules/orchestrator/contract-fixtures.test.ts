// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FakeOrchestratorAdapter } from "./fake";
import type { OrchestratorEvent, SubmitWorkflowCommand, SubmittedWorkflow, WorkflowStatus } from "./contract";

async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "src/test/fixtures/orchestrator/v1", name), "utf8")) as T;
}

describe("consumer-driven orchestrator v1 fixtures", () => {
  it("matches health, idempotent submission, status and sequenced event pages", async () => {
    const health = await fixture<{ contractVersion: string; status: "available" }>("health.json");
    const submission = await fixture<{ command: SubmitWorkflowCommand; response: SubmittedWorkflow }>("submission.json");
    const status = await fixture<WorkflowStatus>("status.json");
    const page = await fixture<{ cursor: number; events: OrchestratorEvent[]; nextCursor: number }>("events.json");
    const adapter = new FakeOrchestratorAdapter([], true, [status], page.events);
    await expect(adapter.health()).resolves.toEqual(health);
    await expect(adapter.submit(submission.command)).resolves.toEqual(submission.response);
    await expect(adapter.submit(submission.command)).resolves.toEqual(submission.response);
    expect(adapter.submitted).toHaveLength(1);
    await expect(adapter.status(status.workflowRunId)).resolves.toEqual(status);
    await expect(adapter.events(page.cursor)).resolves.toEqual({ events: page.events, nextCursor: page.nextCursor });
  });
});
