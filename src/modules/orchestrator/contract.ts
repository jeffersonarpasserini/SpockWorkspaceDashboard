import type { OrchestratorCapabilityState, RunStatus } from "../control-plane/domain";

export interface OrchestratorCapability {
  name: string;
  state: OrchestratorCapabilityState;
  contractVersion: string;
}

export interface SubmitWorkflowCommand {
  requestId: string;
  projectId: string;
  taskId: string;
  workflowVersion: string;
  profile: string;
  objective: string;
  budgetMaximumUsd?: number;
}

export interface SubmittedWorkflow {
  workflowRunId: string;
  requestId: string;
  status: RunStatus;
}

export interface OrchestratorHealth {
  contractVersion: string;
  status: "available" | "degraded";
}

export interface WorkflowStatus {
  workflowRunId: string;
  requestId: string;
  status: RunStatus;
  lastSequence: number;
}

export interface OrchestratorEvent {
  eventId: string;
  deduplicationKey: string;
  workflowRunId: string;
  sequence: number;
  type: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface EventPage {
  events: readonly OrchestratorEvent[];
  nextCursor: number;
}

export interface OrchestratorAdapter {
  health(): Promise<OrchestratorHealth>;
  capabilities(): Promise<readonly OrchestratorCapability[]>;
  submit(command: SubmitWorkflowCommand): Promise<SubmittedWorkflow>;
  status(workflowRunId: string): Promise<WorkflowStatus | null>;
  events(cursor: number, limit?: number): Promise<EventPage>;
}
