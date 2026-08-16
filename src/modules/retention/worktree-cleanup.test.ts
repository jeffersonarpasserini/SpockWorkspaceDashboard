// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { planWorktreeCleanup } from "./worktree-cleanup";

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), "spock-retention-path-"));
  created.push(base);
  const runRoot = path.join(base, "runs");
  const target = path.join(runRoot, "run-1");
  const outside = path.join(base, "outside");
  await Promise.all([mkdir(target, { recursive: true }), mkdir(outside)]);
  await writeFile(path.join(target, "evidence.txt"), "must remain present");
  return { base, runRoot, target, outside };
}

describe("worktree retention cleanup planning", () => {
  it("returns a canonical dry-run plan without modifying the target", async () => {
    const { base, runRoot, target } = await fixture();
    await expect(planWorktreeCleanup({ runRoot, candidate: target, protectedRoots: [base] })).resolves.toMatchObject({ runRoot, target, targetKind: "directory", dryRun: true });
    await expect(writeFile(path.join(target, "still-present.txt"), "present")).resolves.toBeUndefined();
  });

  it("rejects direct and nested symlink escapes", async () => {
    const { runRoot, target, outside } = await fixture();
    const directLink = path.join(runRoot, "direct-link");
    await symlink(outside, directLink, "dir");
    await expect(planWorktreeCleanup({ runRoot, candidate: directLink, protectedRoots: [] })).rejects.toThrow(/symlink/);

    const nestedLink = path.join(target, "nested-link");
    await symlink(outside, nestedLink, "dir");
    await expect(planWorktreeCleanup({ runRoot, candidate: path.join(nestedLink, "child"), protectedRoots: [] })).rejects.toThrow();
  });

  it("rejects outside, root-equal, protected and non-directory targets", async () => {
    const { base, runRoot, target, outside } = await fixture();
    await expect(planWorktreeCleanup({ runRoot, candidate: outside, protectedRoots: [] })).rejects.toThrow(/escapes/);
    await expect(planWorktreeCleanup({ runRoot, candidate: runRoot, protectedRoots: [] })).rejects.toThrow(/escapes/);
    await expect(planWorktreeCleanup({ runRoot: base, candidate: target, protectedRoots: [base] })).rejects.toThrow(/protected/);
    await expect(planWorktreeCleanup({ runRoot, candidate: path.join(target, "evidence.txt"), protectedRoots: [] })).rejects.toThrow(/directory/);
  });
});

