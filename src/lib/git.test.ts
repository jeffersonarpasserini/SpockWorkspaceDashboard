import { describe, expect, it, vi } from "vitest";
import { readGitEvidence } from "./git";

describe("Git evidence", () => {
  it("returns branch, dirty state and latest commit from fixed commands", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce({ stdout: "main\n" })
      .mockResolvedValueOnce({ stdout: " M src/app.ts\n" })
      .mockResolvedValueOnce({ stdout: "abc123\u0000Add dashboard\n" });

    const evidence = await readGitEvidence("/workspace/Project", runner);

    expect(evidence).toMatchObject({ availability: "available", branch: "main", dirty: true, commit: "abc123", message: "Add dashboard" });
    expect(runner).toHaveBeenCalledTimes(3);
    expect(runner.mock.calls[0][1]).toEqual(["-c", "safe.directory=/workspace/Project", "branch", "--show-current"]);
  });

  it("keeps branch and worktree evidence for a repository with no commits", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce({ stdout: "main\n" })
      .mockResolvedValueOnce({ stdout: "?? README.md\n" })
      .mockRejectedValueOnce(new Error("no commits yet"));

    await expect(readGitEvidence("/workspace/NewProject", runner)).resolves.toMatchObject({
      availability: "available",
      branch: "main",
      dirty: true
    });
  });

  it("returns unavailable without leaking command output", async () => {
    const evidence = await readGitEvidence("/workspace/Project", vi.fn().mockRejectedValue(new Error("token=secret")));
    expect(evidence).toEqual({ availability: "unavailable", message: "Git unavailable" });
  });
});
