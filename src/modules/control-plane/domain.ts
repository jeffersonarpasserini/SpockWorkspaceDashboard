export const TASK_STATUSES = [
  "triage",
  "todo",
  "ready",
  "running",
  "blocked",
  "implemented",
  "validating",
  "review",
  "accepted",
  "cancelled",
  "archived"
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SPEC_CHANGE_STATUSES = [
  "draft",
  "proposed",
  "approved",
  "in_progress",
  "blocked",
  "implemented",
  "validated",
  "released",
  "archived",
  "cancelled"
] as const;

export type SpecChangeStatus = (typeof SPEC_CHANGE_STATUSES)[number];

export const RUN_STATUSES = [
  "queued",
  "preparing",
  "running",
  "waiting_input",
  "blocked",
  "retry_scheduled",
  "succeeded",
  "failed",
  "cancelled",
  "timed_out",
  "superseded",
  "lost"
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const ORCHESTRATOR_CAPABILITY_STATES = [
  "implemented",
  "validated_shadow",
  "planned",
  "unavailable"
] as const;

export type OrchestratorCapabilityState = (typeof ORCHESTRATOR_CAPABILITY_STATES)[number];

export const TEAM_ROLES = [
  "supervisor",
  "architect",
  "implementer",
  "debugger",
  "tester",
  "reviewer",
  "data-specialist",
  "operator"
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export interface TeamMemberDefinition {
  role: TeamRole;
  profile: string;
  responsibility: string;
}

export const INITIAL_ENGINEERING_TEAM: readonly TeamMemberDefinition[] = [
  { role: "supervisor", profile: "spock", responsibility: "Classification, plan approval and final synthesis" },
  { role: "architect", profile: "la-forge", responsibility: "Solution design and engineering direction" },
  { role: "implementer", profile: "b-elanna", responsibility: "Backend, APIs, integrations and refactoring" },
  { role: "debugger", profile: "barclay", responsibility: "Reproduction and localized fixes" },
  { role: "tester", profile: "rutherford", responsibility: "Tests, CI and automation" },
  { role: "reviewer", profile: "tuvok", responsibility: "Logic, security and rigorous review" },
  { role: "data-specialist", profile: "data", responsibility: "SQL, data analysis and structured documentation" },
  { role: "operator", profile: "obrien", responsibility: "Docker, infrastructure and operational execution" }
] as const;

export interface StableIdentity {
  id: string;
  version: number;
}

export interface Project extends StableIdentity {
  workspaceId: string;
  name: string;
  slug: string;
  status: "active" | "paused" | "completed" | "archived";
}

export interface SpecChange extends StableIdentity {
  projectId: string;
  externalKey: string;
  title: string;
  status: SpecChangeStatus;
  sourceRevision: string;
}

export interface Task extends StableIdentity {
  projectId: string;
  specChangeId?: string;
  stableKey: string;
  title: string;
  status: TaskStatus;
}

export interface AgentProfileSnapshot extends StableIdentity {
  agentId: string;
  profile: string;
  model: string;
  provider: string;
  billingMode: string;
  configurationHash: string;
  capabilities: readonly string[];
}

export interface Run extends StableIdentity {
  taskId: string;
  agentId: string;
  agentProfileVersionId: string;
  attempt: number;
  status: RunStatus;
  requestId: string;
  correlationId: string;
}
