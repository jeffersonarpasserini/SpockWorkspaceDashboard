// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseCapabilitySpec, readOpenSpecChangeSnapshot } from "./snapshot";

const created: string[] = [];
afterEach(async () => Promise.all(created.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))));

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "spock-snapshot-"));
  created.push(root);
  const change = path.join(root, "openspec", "changes", "add-sample");
  await mkdir(path.join(change, "specs", "sample-capability"), { recursive: true });
  await writeFile(path.join(change, "proposal.md"), "# Change: Sample control plane\n\n## Why\nBecause.");
  await writeFile(path.join(change, "design.md"), "# Design\n\nDetails.");
  await writeFile(path.join(change, "tasks.md"), "## Work\n- [ ] 1.1 Import documents\n- [x] 1.2 Persist tasks");
  await writeFile(path.join(change, "specs", "sample-capability", "spec.md"), `## ADDED Requirements

### Requirement: Durable import
The system MUST persist intent.

#### Scenario: Valid snapshot
- **WHEN** documents are valid
- **THEN** the snapshot is saved

#### Scenario: Invalid snapshot
- **WHEN** a read fails
- **THEN** prior state remains`);
  return root;
}

describe("OpenSpec change snapshots", () => {
  it("imports proposal, design, tasks, requirements and scenarios with one revision", async () => {
    const snapshot = await readOpenSpecChangeSnapshot(await fixture(), "add-sample");
    expect(snapshot).toMatchObject({ changeKey: "add-sample", title: "Sample control plane" });
    expect(snapshot.documents.map((document) => document.kind)).toEqual(["proposal", "tasks", "design", "spec"]);
    expect(snapshot.tasks).toHaveLength(2);
    expect(snapshot.requirements[0]).toMatchObject({
      externalRef: "sample-capability:R1",
      title: "Durable import",
      scenarios: [
        expect.objectContaining({ externalRef: "sample-capability:R1:S1", title: "Valid snapshot" }),
        expect.objectContaining({ externalRef: "sample-capability:R1:S2", title: "Invalid snapshot" })
      ]
    });
    expect(snapshot.sourceRevision).toMatch(/^[0-9a-f]{64}$/);
  });

  it("extracts each requirement body independently", () => {
    const parsed = parseCapabilitySpec("### Requirement: One\nFirst.\n\n### Requirement: Two\nSecond.", "cap");
    expect(parsed.map(({ title, body }) => ({ title, body }))).toEqual([{ title: "One", body: "First." }, { title: "Two", body: "Second." }]);
  });

  it("rejects a spec symlink escaping the change", async () => {
    const root = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "spock-outside-"));
    created.push(outside);
    await writeFile(path.join(outside, "spec.md"), "### Requirement: Secret\nDo not import.");
    const target = path.join(root, "openspec", "changes", "add-sample", "specs", "sample-capability", "spec.md");
    await rm(target);
    await symlink(path.join(outside, "spec.md"), target);
    await expect(readOpenSpecChangeSnapshot(root, "add-sample")).rejects.toThrow();
  });
});
