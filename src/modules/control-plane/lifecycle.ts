import type { RunStatus, SpecChangeStatus, TaskStatus } from "./domain";

const taskTransitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  triage: ["todo", "cancelled"],
  todo: ["ready", "cancelled"],
  ready: ["running", "blocked", "cancelled"],
  running: ["blocked", "implemented", "cancelled"],
  blocked: ["ready", "running", "cancelled"],
  implemented: ["validating", "running", "cancelled"],
  validating: ["review", "running", "blocked", "cancelled"],
  review: ["accepted", "running", "blocked", "cancelled"],
  accepted: ["running", "archived"],
  cancelled: ["todo", "archived"],
  archived: []
};

const runTransitions: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  queued: ["preparing", "cancelled"],
  preparing: ["running", "failed", "cancelled", "lost"],
  running: ["waiting_input", "blocked", "succeeded", "failed", "cancelled", "timed_out", "lost"],
  waiting_input: ["running", "blocked", "cancelled", "timed_out", "lost"],
  blocked: ["retry_scheduled", "cancelled", "superseded"],
  retry_scheduled: ["queued", "cancelled", "superseded"],
  succeeded: [],
  failed: ["retry_scheduled", "superseded"],
  cancelled: [],
  timed_out: ["retry_scheduled", "superseded"],
  superseded: [],
  lost: ["retry_scheduled", "superseded"]
};

const specTransitions: Readonly<Record<SpecChangeStatus, readonly SpecChangeStatus[]>> = {
  draft: ["proposed", "cancelled"],
  proposed: ["approved", "draft", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["blocked", "implemented", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  implemented: ["validated", "in_progress", "cancelled"],
  validated: ["released", "in_progress", "cancelled"],
  released: ["archived"],
  archived: [],
  cancelled: ["draft", "archived"]
};

function canTransition<T extends string>(table: Readonly<Record<T, readonly T[]>>, from: T, to: T): boolean {
  return table[from].includes(to);
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return canTransition(taskTransitions, from, to);
}

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return canTransition(runTransitions, from, to);
}

export function canTransitionSpecChange(from: SpecChangeStatus, to: SpecChangeStatus): boolean {
  return canTransition(specTransitions, from, to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) throw new Error(`Invalid task transition: ${from} -> ${to}`);
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransitionRun(from, to)) throw new Error(`Invalid run transition: ${from} -> ${to}`);
}

export function assertSpecChangeTransition(from: SpecChangeStatus, to: SpecChangeStatus): void {
  if (!canTransitionSpecChange(from, to)) throw new Error(`Invalid spec change transition: ${from} -> ${to}`);
}
