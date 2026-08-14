// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { OpenSpecBackgroundSync } from "./background-sync";

describe("bounded OpenSpec background synchronization", () => {
  it("synchronizes discovered changes through the read-only source", async () => {
    const registration = { ensure: vi.fn().mockResolvedValue("source"), recordPartial: vi.fn() };
    const syncService = { synchronize: vi.fn().mockResolvedValue({}) };
    const catalog = vi.fn().mockResolvedValue({ keys: ["add-a", "add-b"], truncated: false });
    const service = new OpenSpecBackgroundSync(registration, syncService, catalog, () => 1_000);
    const result = await service.run({ projectId: "project", externalProjectId: "external", projectPath: "/workspace/project" });

    expect(result).toMatchObject({ synchronized: 2, failed: 0, truncated: false, deadlineReached: false });
    expect(syncService.synchronize).toHaveBeenCalledTimes(2);
    expect(registration.recordPartial).not.toHaveBeenCalled();
  });

  it("records partial freshness for limits and sanitized per-change failures", async () => {
    const registration = { ensure: vi.fn().mockResolvedValue("source"), recordPartial: vi.fn().mockResolvedValue(undefined) };
    const syncService = { synchronize: vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("secret /root")) };
    const service = new OpenSpecBackgroundSync(registration, syncService, async () => ({ keys: ["add-a", "add-b"], truncated: true }), () => 1_000);
    const result = await service.run({ projectId: "project", externalProjectId: "external", projectPath: "/workspace/project", maxChanges: 2 });

    expect(result).toMatchObject({ synchronized: 1, failed: 1, truncated: true });
    expect(registration.recordPartial).toHaveBeenCalledWith("source", expect.any(Date), "OpenSpecBatchLimit", { discovered: 2, synchronized: 1, failed: 1 });
  });

  it("stops before starting another change when its time budget is exhausted", async () => {
    const registration = { ensure: vi.fn().mockResolvedValue("source"), recordPartial: vi.fn().mockResolvedValue(undefined) };
    const syncService = { synchronize: vi.fn().mockResolvedValue({}) };
    const times = [1_000, 1_050, 1_101];
    const service = new OpenSpecBackgroundSync(registration, syncService, async () => ({ keys: ["add-a", "add-b"], truncated: false }), () => times.shift() ?? 1_101);
    const result = await service.run({ projectId: "project", externalProjectId: "external", projectPath: "/workspace/project", timeBudgetMs: 100 });

    expect(result).toMatchObject({ synchronized: 1, deadlineReached: true });
    expect(syncService.synchronize).toHaveBeenCalledTimes(1);
    expect(registration.recordPartial).toHaveBeenCalledWith("source", expect.any(Date), "OpenSpecTimeBudget", expect.any(Object));
  });

  it("rejects unbounded job parameters", async () => {
    const service = new OpenSpecBackgroundSync({ ensure: vi.fn(), recordPartial: vi.fn() }, { synchronize: vi.fn() });
    await expect(service.run({ projectId: "p", externalProjectId: "e", projectPath: "/p", maxChanges: 0 })).rejects.toThrow("Invalid maxChanges");
    await expect(service.run({ projectId: "p", externalProjectId: "e", projectPath: "/p", timeBudgetMs: 999_999 })).rejects.toThrow("Invalid timeBudgetMs");
  });
});
