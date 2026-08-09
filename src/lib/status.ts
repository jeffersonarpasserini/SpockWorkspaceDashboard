import type { KanbanStatus, ProjectStatus } from "./types";

interface ProjectStatusEvidence {
  checked: number;
  unchecked: number;
  hermesStatuses: KanbanStatus[];
  gitAvailable: boolean;
  openspecAvailable: boolean;
  hermesAvailable: boolean;
}

export function deriveProjectStatus(input: ProjectStatusEvidence): ProjectStatus {
  if (input.hermesStatuses.includes("blocked")) return "blocked";
  if (input.hermesStatuses.includes("running") || input.hermesStatuses.includes("ready") || input.unchecked > 0) {
    return "in_progress";
  }
  const allSourcesAvailable = input.gitAvailable && input.openspecAvailable && input.hermesAvailable;
  if (allSourcesAvailable && input.checked > 0 && input.hermesStatuses.every((status) => status === "done" || status === "archived")) {
    return "complete_locally";
  }
  return "unknown";
}
