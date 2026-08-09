export const KANBAN_STATUSES = ["triage", "todo", "ready", "running", "blocked", "done", "archived"] as const;
export type KanbanStatus = (typeof KANBAN_STATUSES)[number];
export type ProjectStatus = "blocked" | "in_progress" | "complete_locally" | "unknown";
export type SourceAvailability = "available" | "unavailable" | "not_configured";

export interface BoardTask {
  id: string;
  title: string;
  status: KanbanStatus;
  source: "hermes" | "openspec";
  assignee?: string;
  body?: string;
  change?: string;
  section?: string;
  priority?: number;
  blockedReason?: string;
  updatedAt?: string;
}

export interface ProjectIdentity {
  id: string;
  name: string;
  markers: string[];
}

export interface GitEvidence {
  availability: SourceAvailability;
  branch?: string;
  dirty?: boolean;
  commit?: string;
  message?: string;
}

export interface OpenSpecEvidence {
  availability: SourceAvailability;
  checked: number;
  unchecked: number;
  changes: number;
  tasks: BoardTask[];
  message?: string;
}

export interface HermesEvidence {
  availability: SourceAvailability;
  board: string;
  tasks: BoardTask[];
  message?: string;
}

export interface ProjectSummary extends ProjectIdentity {
  git: GitEvidence;
  openspec: Omit<OpenSpecEvidence, "tasks">;
  hermes: Omit<HermesEvidence, "tasks"> & { running: number; blocked: number };
  status: ProjectStatus;
  observedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  tasks: BoardTask[];
}
