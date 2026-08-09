import { describe, expect, it, vi } from "vitest";
import { createDashboardService } from "./dashboard";

describe("dashboard service", () => {
  it("combines project evidence and keeps running agent work", async () => {
    const service = createDashboardService({
      workspaceRoot: "/workspace",
      boardMap: { Alpha: "alpha-board" },
      hermesBin: "hermes",
      discover: vi.fn().mockResolvedValue([{ id: "QWxwaGE", name: "Alpha", markers: [".git", "openspec"] }]),
      resolve: vi.fn().mockResolvedValue("/workspace/Alpha"),
      readGit: vi.fn().mockResolvedValue({ availability: "available", branch: "main", dirty: false }),
      readOpenSpec: vi.fn().mockResolvedValue({ availability: "available", checked: 1, unchecked: 1, changes: 1, tasks: [{ id: "openspec:1", title: "Pending", status: "todo", source: "openspec", change: "add-x", section: "Build" }] }),
      readHermes: vi.fn().mockResolvedValue({ availability: "available", board: "alpha-board", tasks: [{ id: "hermes:1", title: "Implement", status: "running", source: "hermes", assignee: "data" }] })
    });

    const overview = await service.listProjects();
    const detail = await service.getProject("QWxwaGE");

    expect(overview[0]).toMatchObject({ name: "Alpha", status: "in_progress", hermes: { running: 1, blocked: 0 } });
    expect(detail.tasks).toHaveLength(2);
    expect(detail.tasks.find((task) => task.status === "running")?.assignee).toBe("data");
  });
});
