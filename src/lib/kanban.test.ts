import { describe, expect, it, vi } from "vitest";
import { mergeBoardTasks, normalizeHermesTask, readHermesEvidence } from "./kanban";

describe("Hermes Kanban normalization", () => {
  it.each(["triage", "todo", "ready", "running", "blocked", "done", "archived"] as const)("preserves %s status", (status) => {
    expect(normalizeHermesTask({ id: "task-1", title: "Work", status, assignee: "data" })).toMatchObject({
      id: "hermes:task-1",
      status,
      assignee: "data",
      source: "hermes"
    });
  });

  it("rejects unknown task status", () => {
    expect(() => normalizeHermesTask({ id: "1", title: "Bad", status: "mystery" })).toThrow(/status/i);
  });

  it("keeps OpenSpec provenance when merging sources", () => {
    const merged = mergeBoardTasks([], [{ id: "spec:1", title: "Validate", status: "todo", source: "openspec", change: "add-x", section: "Delivery" }]);
    expect(merged[0]).toMatchObject({ source: "openspec", change: "add-x", section: "Delivery" });
  });

  it("marks an unrecognized Hermes payload unavailable", async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: "{}", stderr: "" });
    const evidence = await readHermesEvidence("probe", "hermes", runner);
    expect(runner).toHaveBeenCalledOnce();
    expect(evidence).toMatchObject({ availability: "unavailable", tasks: [] });
  });
});
