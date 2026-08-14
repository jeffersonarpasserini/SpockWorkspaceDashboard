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

export interface OrchestratorAdapter {
  capabilities(): Promise<readonly OrchestratorCapability[]>;
  submit(command: SubmitWorkflowCommand): Promise<SubmittedWorkflow>;
}
