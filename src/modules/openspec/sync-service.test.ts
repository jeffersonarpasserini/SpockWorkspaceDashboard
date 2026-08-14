// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { OpenSpecSyncService } from "./sync-service";

describe("OpenSpec sync last-known-good behavior", () => {
  it("records a sanitized failure without invoking persistence when the bounded read fails", async () => {
    const repository = { importChange: vi.fn(), recordReadFailure: vi.fn().mockResolvedValue(undefined) };
    const reader = { read: vi.fn().mockRejectedValue(new Error("/secret/root must not escape")) };
    const service = new OpenSpecSyncService(repository, reader);
    const observedAt = new Date("2026-08-14T12:00:00Z");

    await expect(service.synchronize({ projectId: "project", sourceId: "source", projectPath: "/private", changeKey: "add-one", observedAt }))
      .rejects.toThrow("OpenSpec source unavailable");
    expect(repository.importChange).not.toHaveBeenCalled();
    expect(repository.recordReadFailure).toHaveBeenCalledWith("source", observedAt, "Error");
  });
});
