import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverProjects, resolveProjectPath } from "./workspace";

const created: string[] = [];
afterEach(async () => {
  await Promise.all(created.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

async function tempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "spock-dashboard-"));
  created.push(root);
  return root;
}

describe("workspace discovery", () => {
  it("lists direct children with project markers", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, "Alpha", ".git"), { recursive: true });
    await mkdir(path.join(root, "Notes"), { recursive: true });
    await writeFile(path.join(root, "Notes", "README.txt"), "not a project");

    const projects = await discoverProjects(root);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: "Alpha" });
    expect(projects[0].id).not.toContain("/");
  });

  it("does not follow a project symlink outside the workspace", async () => {
    const root = await tempRoot();
    const outside = await tempRoot();
    await mkdir(path.join(outside, ".git"));
    await symlink(outside, path.join(root, "Escape"));

    expect(await discoverProjects(root)).toEqual([]);
  });

  it("does not recognize a project through a symlinked marker", async () => {
    const root = await tempRoot();
    const outside = await tempRoot();
    await mkdir(path.join(root, "Escape"));
    await mkdir(path.join(outside, ".git"));
    await symlink(path.join(outside, ".git"), path.join(root, "Escape", ".git"));

    expect(await discoverProjects(root)).toEqual([]);
  });

  it("rejects unknown or tampered identifiers", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, "Alpha", ".git"), { recursive: true });
    await expect(resolveProjectPath(root, "Li4vZXRj")).rejects.toThrow(/project/i);
  });
});
