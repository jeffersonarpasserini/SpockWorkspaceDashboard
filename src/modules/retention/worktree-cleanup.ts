import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

export interface WorktreeCleanupPlan {
  runRoot: string;
  target: string;
  targetKind: "directory";
  dryRun: true;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function planWorktreeCleanup(input: {
  runRoot: string;
  candidate: string;
  protectedRoots: readonly string[];
}): Promise<WorktreeCleanupPlan> {
  if (!path.isAbsolute(input.runRoot) || !path.isAbsolute(input.candidate)) throw new Error("retention cleanup paths must be absolute");
  const rootStat = await lstat(input.runRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("retention run root must be a real directory");
  const canonicalRoot = await realpath(input.runRoot);
  if (canonicalRoot === path.parse(canonicalRoot).root) throw new Error("retention run root is too broad");
  for (const protectedRoot of input.protectedRoots) {
    if (!path.isAbsolute(protectedRoot)) throw new Error("protected roots must be absolute");
    let canonicalProtected: string;
    try { canonicalProtected = await realpath(protectedRoot); } catch { canonicalProtected = path.resolve(protectedRoot); }
    if (canonicalRoot === canonicalProtected) throw new Error("retention run root cannot equal a protected root");
  }
  const candidateStat = await lstat(input.candidate);
  if (candidateStat.isSymbolicLink()) throw new Error("retention cleanup rejects symlink targets");
  if (!candidateStat.isDirectory()) throw new Error("retention cleanup target must be a directory");
  const canonicalCandidate = await realpath(input.candidate);
  if (!isWithin(canonicalRoot, canonicalCandidate)) throw new Error("retention cleanup target escapes the canonical run root");
  return { runRoot: canonicalRoot, target: canonicalCandidate, targetKind: "directory", dryRun: true };
}

