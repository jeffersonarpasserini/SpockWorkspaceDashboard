import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseTasksMarkdown, readOpenSpecEvidence } from "./openspec";

const created: string[] = [];
afterEach(async () => Promise.all(created.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))));

describe("OpenSpec task parsing", () => {
  it("preserves change, section, text and checkbox state", () => {
    const markdown = `## 1. Foundation\n\n- [x] 1.1 Initialize\n- [ ] 1.2 Build dashboard\n  - Evidence: keep this as context\n\n## 2. Delivery\n- [ ] 2.1 Validate`;

    const tasks = parseTasksMarkdown(markdown, "add-dashboard");

    expect(tasks).toEqual([
      expect.objectContaining({ change: "add-dashboard", section: "1. Foundation", title: "1.1 Initialize", status: "done" }),
      expect.objectContaining({ change: "add-dashboard", section: "1. Foundation", title: "1.2 Build dashboard", status: "todo" }),
      expect.objectContaining({ change: "add-dashboard", section: "2. Delivery", title: "2.1 Validate", status: "todo" })
    ]);
  });

  it("ignores narrative checkboxes inside fenced code", () => {
    const markdown = "## Tasks\n```md\n- [ ] example only\n```\n- [ ] real task";
    expect(parseTasksMarkdown(markdown, "change").map((task) => task.title)).toEqual(["real task"]);
  });

  it("counts only active changes and excludes the archive container", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-openspec-"));
    created.push(root);
    await mkdir(path.join(root, "openspec", "changes", "add-live"), { recursive: true });
    await mkdir(path.join(root, "openspec", "changes", "archive", "old-change"), { recursive: true });
    await writeFile(path.join(root, "openspec", "changes", "add-live", "tasks.md"), "- [ ] live task");
    await writeFile(path.join(root, "openspec", "changes", "archive", "old-change", "tasks.md"), "- [x] archived task");

    const evidence = await readOpenSpecEvidence(root);

    expect(evidence.changes).toBe(1);
    expect(evidence.tasks.map((task) => task.title)).toEqual(["live task"]);
  });

  it("does not read a tasks file symlinked outside the project", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-openspec-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "spock-secret-"));
    created.push(root, outside);
    const change = path.join(root, "openspec", "changes", "add-live");
    await mkdir(change, { recursive: true });
    const externalTasks = path.join(outside, "tasks.md");
    await writeFile(externalTasks, "- [ ] external secret task");
    await symlink(externalTasks, path.join(change, "tasks.md"));

    const evidence = await readOpenSpecEvidence(root);

    expect(evidence.tasks).toEqual([]);
  });

  it("does not parse an unbounded tasks file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-openspec-"));
    created.push(root);
    const change = path.join(root, "openspec", "changes", "oversized");
    await mkdir(change, { recursive: true });
    await writeFile(path.join(change, "tasks.md"), `${"x".repeat(1_000_001)}\n- [ ] hidden after oversized content`);

    const evidence = await readOpenSpecEvidence(root);
    expect(evidence.availability).toBe("unavailable");
    expect(evidence.tasks).toEqual([]);
  });

  it("keeps partial counts but marks evidence unavailable when any active change is unreadable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-openspec-"));
    created.push(root);
    const readable = path.join(root, "openspec", "changes", "readable");
    const oversized = path.join(root, "openspec", "changes", "oversized");
    await mkdir(readable, { recursive: true });
    await mkdir(oversized, { recursive: true });
    await writeFile(path.join(readable, "tasks.md"), "- [x] observed task");
    await writeFile(path.join(oversized, "tasks.md"), "x".repeat(1_000_001));

    const evidence = await readOpenSpecEvidence(root);
    expect(evidence).toMatchObject({ availability: "unavailable", checked: 1, unchecked: 0, changes: 2 });
  });

  it("marks a symlinked active change unavailable instead of omitting it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-openspec-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "spock-openspec-outside-"));
    created.push(root, outside);
    const changes = path.join(root, "openspec", "changes");
    const readable = path.join(changes, "readable");
    await mkdir(readable, { recursive: true });
    await writeFile(path.join(readable, "tasks.md"), "- [x] observed task");
    await writeFile(path.join(outside, "tasks.md"), "- [ ] external task");
    await symlink(outside, path.join(changes, "unsafe"), "dir");

    const evidence = await readOpenSpecEvidence(root);
    expect(evidence).toMatchObject({ availability: "unavailable", checked: 1, unchecked: 0, changes: 2 });
    expect(evidence.tasks.map((task) => task.title)).not.toContain("external task");
  });

  it.each(["openspec", "changes"])("does not follow a symlinked %s parent directory", async (symlinkLevel) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "spock-openspec-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "spock-secret-"));
    created.push(root, outside);
    const externalChanges = path.join(outside, "changes");
    await mkdir(path.join(externalChanges, "escape"), { recursive: true });
    await writeFile(path.join(externalChanges, "escape", "tasks.md"), "- [ ] external parent task");

    if (symlinkLevel === "openspec") {
      await symlink(outside, path.join(root, "openspec"));
    } else {
      await mkdir(path.join(root, "openspec"), { recursive: true });
      await symlink(externalChanges, path.join(root, "openspec", "changes"));
    }

    const evidence = await readOpenSpecEvidence(root);
    expect(evidence.tasks).toEqual([]);
  });
});
