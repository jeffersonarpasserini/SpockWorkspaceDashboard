// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseRepositoryBindings,
  parseSpecTasks,
  reconcileSpecTasks,
  type PersistedSpecTask
} from "./reconciliation";

const revision = "git:abc123";
const now = new Date("2026-08-14T12:00:00Z");
let sequence = 0;
const makeId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;

function reconcile(markdown: string, previous: readonly PersistedSpecTask[] = [], bindings?: ReturnType<typeof parseRepositoryBindings>) {
  return reconcileSpecTasks({ observed: parseSpecTasks(markdown, "sample-change"), previous, bindings, sourceRevision: revision, observedAt: now, makeId });
}

describe("OpenSpec task reconciliation", () => {
  it("preserves identity across title, section and order changes when hierarchical references remain stable", () => {
    const first = reconcile("## Build\n- [ ] 1.1 Create schema\n- [ ] 1.2 Add parser");
    const second = reconcile("## Foundation\n- [ ] 1.2 Add strict parser\n- [ ] 1.1 Create durable schema", first.tasks);

    expect(second.entries.map((entry) => entry.kind)).toEqual(["updated", "updated"]);
    expect(second.tasks.find((task) => task.externalRef === "1.1")?.id)
      .toBe(first.tasks.find((task) => task.externalRef === "1.1")?.id);
    expect(second.executable).toBe(true);
  });

  it("classifies checked, reopened and missing without deleting history", () => {
    const first = reconcile("- [ ] 1.1 First\n- [x] 1.2 Second");
    const second = reconcile("- [x] 1.1 First\n- [ ] 1.2 Second", first.tasks);
    expect(second.entries.map((entry) => entry.kind)).toEqual(["checked", "reopened"]);

    const third = reconcile("- [x] 1.1 First", second.tasks);
    expect(third.entries.map((entry) => entry.kind)).toEqual(["unchanged", "missing"]);
    expect(third.entries[1].task.missingAt).toEqual(now);
  });

  it("blocks ambiguous duplicate references", () => {
    const result = reconcile("- [ ] 1.1 First\n- [ ] 1.1 Duplicate");
    expect(result.entries.map((entry) => entry.kind)).toEqual(["conflicted", "conflicted"]);
    expect(result.executable).toBe(false);
  });

  it("marks unbound tasks unstable and accepts valid repository-local bindings", () => {
    const markdown = "## Work\n- [ ] An unnumbered task";
    expect(reconcile(markdown).entries[0].kind).toBe("unstable");

    const bindings = parseRepositoryBindings({
      version: 1,
      tasks: { "sample-change::Work::An unnumbered task": "10000000-0000-4000-8000-000000000001" }
    });
    const bound = reconcile(markdown, [], bindings);
    expect(bound.entries[0]).toMatchObject({ kind: "created", task: { id: "10000000-0000-4000-8000-000000000001", identityStatus: "stable" } });
    expect(bound.executable).toBe(true);
  });

  it("ignores fenced examples and rejects malformed binding files", () => {
    expect(parseSpecTasks("```md\n- [ ] 9.9 Example\n```\n- [ ] 1.1 Real", "sample-change")).toHaveLength(1);
    expect(() => parseRepositoryBindings({ version: 1, tasks: { bad: "not-a-uuid" } })).toThrow("Invalid OpenSpec task binding");
  });
});
