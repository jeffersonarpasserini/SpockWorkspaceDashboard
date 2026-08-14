import type {
  OrchestratorAdapter,
  OrchestratorCapability,
  SubmitWorkflowCommand,
  SubmittedWorkflow
} from "./contract";

export class IntegrationHoldError extends Error {
  constructor() {
    super("Live Agent Orchestrator integration is disabled by project premise");
    this.name = "IntegrationHoldError";
  }
}

export class FakeOrchestratorAdapter implements OrchestratorAdapter {
  readonly submitted: SubmitWorkflowCommand[] = [];

  constructor(
    private readonly declaredCapabilities: readonly OrchestratorCapability[] = [],
    private readonly allowFixtureSubmission = false
  ) {}

  async capabilities(): Promise<readonly OrchestratorCapability[]> {
    return this.declaredCapabilities;
  }

  async submit(command: SubmitWorkflowCommand): Promise<SubmittedWorkflow> {
    if (!this.allowFixtureSubmission) throw new IntegrationHoldError();
    this.submitted.push(structuredClone(command));
    return {
      workflowRunId: `fixture:${command.requestId}`,
      requestId: command.requestId,
      status: "queued"
    };
  }
}
