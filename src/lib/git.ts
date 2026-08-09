import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitEvidence } from "./types";

const execFileAsync = promisify(execFile);
type Runner = (file: string, args: string[], options: { cwd: string; timeout: number; maxBuffer: number; windowsHide: boolean }) => Promise<{ stdout: string }>;

const defaultRunner: Runner = async (file, args, options) => {
  const result = await execFileAsync(file, args, options);
  return { stdout: result.stdout };
};

export async function readGitEvidence(projectPath: string, runner: Runner = defaultRunner): Promise<GitEvidence> {
  const options = { cwd: projectPath, timeout: 5_000, maxBuffer: 512_000, windowsHide: true };
  const gitArgs = (args: string[]) => ["-c", `safe.directory=${projectPath}`, ...args];
  try {
    const [branchResult, statusResult] = await Promise.all([
      runner("git", gitArgs(["branch", "--show-current"]), options),
      runner("git", gitArgs(["status", "--porcelain"]), options)
    ]);
    let commit: string | undefined;
    let message: string | undefined;
    try {
      const commitResult = await runner("git", gitArgs(["log", "-1", "--pretty=format:%h%x00%s"]), options);
      [commit, message] = commitResult.stdout.split("\0", 2).map((value) => value.trim() || undefined);
    } catch {
      // A newly initialized repository can have valid branch/worktree evidence without a commit.
    }
    return {
      availability: "available",
      branch: branchResult.stdout.trim() || "detached",
      dirty: statusResult.stdout.trim().length > 0,
      commit,
      message
    };
  } catch {
    return { availability: "unavailable", message: "Git unavailable" };
  }
}
