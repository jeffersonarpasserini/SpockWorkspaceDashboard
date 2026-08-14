import { randomUUID } from "node:crypto";

export type TaskIdentityStatus = "stable" | "unstable" | "conflicted";
export type ReconciliationKind = "created" | "updated" | "checked" | "reopened" | "missing" | "conflicted" | "unstable" | "unchanged";

export interface ObservedSpecTask {
  change: string;
  section: string;
  title: string;
  checked: boolean;
  ordinal: number;
  externalRef?: string;
  bindingKey: string;
}

export interface PersistedSpecTask extends ObservedSpecTask {
  id: string;
  sourceRevision: string;
  identityStatus: TaskIdentityStatus;
  missingAt: Date | null;
}

export interface RepositoryBindings {
  version: 1;
  tasks: Readonly<Record<string, string>>;
}

export interface ReconciliationEntry {
  kind: ReconciliationKind;
  task: PersistedSpecTask;
}

export interface ReconciliationResult {
  entries: readonly ReconciliationEntry[];
  tasks: readonly PersistedSpecTask[];
  executable: boolean;
}

const TASK_LINE = /^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/;
const HIERARCHICAL_REF = /^(\d+(?:\.\d+)+)\s+(.+)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function taskBindingKey(change: string, section: string, title: string): string {
  return `${change}::${section}::${title}`;
}

export function parseSpecTasks(markdown: string, change: string): readonly ObservedSpecTask[] {
  const tasks: ObservedSpecTask[] = [];
  let section = "Tasks";
  let fenced = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = line.match(/^#{2,6}\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1];
      continue;
    }
    const checkbox = line.match(TASK_LINE);
    if (!checkbox) continue;
    const reference = checkbox[2].match(HIERARCHICAL_REF);
    const title = reference?.[2] ?? checkbox[2];
    tasks.push({
      change,
      section,
      title,
      checked: checkbox[1].toLowerCase() === "x",
      ordinal: tasks.length,
      externalRef: reference?.[1],
      bindingKey: taskBindingKey(change, section, title)
    });
  }
  return tasks;
}

export function parseRepositoryBindings(value: unknown): RepositoryBindings {
  if (!value || typeof value !== "object") throw new Error("Invalid OpenSpec bindings");
  const candidate = value as { version?: unknown; tasks?: unknown };
  if (candidate.version !== 1 || !candidate.tasks || typeof candidate.tasks !== "object" || Array.isArray(candidate.tasks)) {
    throw new Error("Invalid OpenSpec bindings");
  }
  const tasks = candidate.tasks as Record<string, unknown>;
  for (const [key, id] of Object.entries(tasks)) {
    if (!key.trim() || typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid OpenSpec task binding");
  }
  return { version: 1, tasks: tasks as Record<string, string> };
}

export function reconcileSpecTasks(input: {
  observed: readonly ObservedSpecTask[];
  previous: readonly PersistedSpecTask[];
  bindings?: RepositoryBindings;
  sourceRevision: string;
  observedAt: Date;
  makeId?: () => string;
}): ReconciliationResult {
  const makeId = input.makeId ?? randomUUID;
  const duplicateRefs = duplicates(input.observed.flatMap((task) => task.externalRef ? [`${task.change}:${task.externalRef}`] : []));
  const previousByRef = new Map(input.previous.filter((task) => task.externalRef).map((task) => [`${task.change}:${task.externalRef}`, task]));
  const previousById = new Map(input.previous.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const entries: ReconciliationEntry[] = [];

  for (const observed of input.observed) {
    const refKey = observed.externalRef ? `${observed.change}:${observed.externalRef}` : undefined;
    const boundId = input.bindings?.tasks[observed.bindingKey];
    const previous = (refKey ? previousByRef.get(refKey) : undefined) ?? (boundId ? previousById.get(boundId) : undefined);
    const conflicted = Boolean(refKey && duplicateRefs.has(refKey));
    const stable = Boolean(observed.externalRef || boundId);
    const identityStatus: TaskIdentityStatus = conflicted ? "conflicted" : stable ? "stable" : "unstable";
    const task: PersistedSpecTask = {
      ...observed,
      id: previous?.id ?? boundId ?? makeId(),
      sourceRevision: input.sourceRevision,
      identityStatus,
      missingAt: null
    };
    seen.add(task.id);

    let kind: ReconciliationKind;
    if (conflicted) kind = "conflicted";
    else if (!stable) kind = "unstable";
    else if (!previous) kind = "created";
    else if (!previous.checked && task.checked) kind = "checked";
    else if (previous.checked && !task.checked) kind = "reopened";
    else if (changed(previous, task)) kind = "updated";
    else kind = "unchanged";
    entries.push({ kind, task });
  }

  for (const previous of input.previous) {
    if (seen.has(previous.id) || previous.missingAt) continue;
    const task = { ...previous, sourceRevision: input.sourceRevision, missingAt: input.observedAt };
    entries.push({ kind: "missing", task });
  }

  return {
    entries,
    tasks: entries.map((entry) => entry.task),
    executable: entries.every((entry) => entry.task.identityStatus === "stable")
  };
}

function duplicates(values: readonly string[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const result = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) result.add(value);
    else seen.add(value);
  }
  return result;
}

function changed(previous: PersistedSpecTask, next: PersistedSpecTask): boolean {
  return previous.title !== next.title || previous.section !== next.section || previous.ordinal !== next.ordinal || previous.missingAt !== null;
}
