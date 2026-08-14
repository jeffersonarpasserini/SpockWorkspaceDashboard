// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listActiveOpenSpecChanges } from "./change-catalog";

const created: string[] = [];
afterEach(async () => Promise.all(created.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))));

describe("active OpenSpec change catalog", () => {
  it("sorts, excludes archive and enforces the batch limit", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-change-catalog-"));
    created.push(root);
    for (const name of ["change-c", "change-a", "change-b", "archive"]) await mkdir(path.join(root, "openspec", "changes", name), { recursive: true });
    await expect(listActiveOpenSpecChanges(root, 2)).resolves.toEqual({ keys: ["change-a", "change-b"], truncated: true });
  });

  it("rejects symlinked active changes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-change-catalog-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "spock-change-outside-"));
    created.push(root, outside);
    await mkdir(path.join(root, "openspec", "changes"), { recursive: true });
    await symlink(outside, path.join(root, "openspec", "changes", "unsafe-change"), "dir");
    await expect(listActiveOpenSpecChanges(root, 10)).rejects.toThrow("Unsafe OpenSpec change entry");
  });
});
