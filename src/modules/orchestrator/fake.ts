import type {
  OrchestratorAdapter,
  OrchestratorCapability,
  OrchestratorEvent,
  OrchestratorHealth,
  SubmitWorkflowCommand,
  SubmittedWorkflow,
  WorkflowStatus
} from "./contract";

export class IntegrationHoldError extends Error {
  constructor() {
    super("Live Agent Orchestrator integration is disabled by project premise");
    this.name = "IntegrationHoldError";
  }
}

export class FakeOrchestratorAdapter implements OrchestratorAdapter {
  readonly submitted: SubmitWorkflowCommand[] = [];
  private readonly submissionsByRequest = new Map<string, SubmittedWorkflow>();

  constructor(
    private readonly declaredCapabilities: readonly OrchestratorCapability[] = [],
    private readonly allowFixtureSubmission = false,
    private readonly fixtureStatuses: readonly WorkflowStatus[] = [],
    private readonly fixtureEvents: readonly OrchestratorEvent[] = []
  ) {}

  async health(): Promise<OrchestratorHealth> {
    return { contractVersion: "fixture-v1", status: "available" };
  }

  async capabilities(): Promise<readonly OrchestratorCapability[]> {
    return this.declaredCapabilities;
  }

  async submit(command: SubmitWorkflowCommand): Promise<SubmittedWorkflow> {
    if (!this.allowFixtureSubmission) throw new IntegrationHoldError();
    const existing = this.submissionsByRequest.get(command.requestId);
    if (existing) return existing;
    this.submitted.push(structuredClone(command));
    const submitted = {
      workflowRunId: `fixture:${command.requestId}`,
      requestId: command.requestId,
      status: "queued" as const
    };
    this.submissionsByRequest.set(command.requestId, submitted);
    return submitted;
  }

  async status(workflowRunId: string): Promise<WorkflowStatus | null> {
    return structuredClone(this.fixtureStatuses.find((status) => status.workflowRunId === workflowRunId) ?? null);
  }

  async events(cursor: number, limit = 100): Promise<{ events: readonly OrchestratorEvent[]; nextCursor: number }> {
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("Invalid fixture event cursor");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Invalid fixture event page limit");
    const events = this.fixtureEvents.filter(({ sequence }) => sequence > cursor).sort((a, b) => a.sequence - b.sequence).slice(0, limit).map((event) => structuredClone(event));
    return { events, nextCursor: events.at(-1)?.sequence ?? cursor };
  }
}
