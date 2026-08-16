const OPAQUE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COST_CLASSES = ["actual", "estimated", "simulated", "allocated", "infrastructure"] as const;
export type CostClass = (typeof COST_CLASSES)[number];

export interface AssignmentInvariant {
  projectId: string;
  taskId: string;
  roleId: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface WorkflowVersionInvariant {
  templateId: string;
  version: number;
  roles: readonly string[];
  transitions: readonly { from: string; to: string }[];
  correctionLimit: number;
  approvalGates: readonly string[];
}

export interface RunInvariant {
  taskId: string;
  agentId: string;
  agentProfileVersionId: string;
  requestId: string;
  correlationId: string;
  attempt: number;
}

export interface EvidenceInvariant {
  type: string;
  taskId: string;
  runId: string | null;
  sourceRevision: string;
  createdAt: Date;
  verificationState: string;
  contentHash: string | null;
  externalReference: string | null;
}

export interface CostEntryInvariant {
  runId: string;
  costClass: CostClass;
  amount: number;
  currency: string;
  priceSnapshotId: string | null;
}

export function assertOpaqueId(id: string, field = "id"): void {
  if (!OPAQUE_ID.test(id)) throw new Error(`${field} must be an opaque application ID`);
}

export function assertStableTaskIdentity(taskId: string, projectId: string, stableKey: string): void {
  assertOpaqueId(taskId, "taskId");
  assertOpaqueId(projectId, "projectId");
  if (!stableKey.trim()) throw new Error("stableKey is required and must not be derived from display text");
}

export function assertAssignmentInvariant(assignment: AssignmentInvariant): void {
  assertOpaqueId(assignment.projectId, "projectId");
  assertOpaqueId(assignment.taskId, "taskId");
  assertOpaqueId(assignment.roleId, "roleId");
  if (assignment.endsAt && assignment.endsAt < assignment.startsAt) {
    throw new Error("assignment end must not precede its start");
  }
}

export function assertWorkflowVersionInvariant(workflow: WorkflowVersionInvariant): void {
  assertOpaqueId(workflow.templateId, "templateId");
  if (!Number.isSafeInteger(workflow.version) || workflow.version < 1) throw new Error("workflow version must be positive");
  if (workflow.roles.length === 0 || workflow.transitions.length === 0) throw new Error("workflow roles and transitions are required");
  if (!Number.isSafeInteger(workflow.correctionLimit) || workflow.correctionLimit < 0 || workflow.correctionLimit > 2) {
    throw new Error("workflow correction limit must be between zero and two");
  }
  if (workflow.approvalGates.length === 0) throw new Error("workflow approval gates are required");
}

export function assertRunInvariant(run: RunInvariant): void {
  for (const [field, id] of [["taskId", run.taskId], ["agentId", run.agentId], ["agentProfileVersionId", run.agentProfileVersionId]] as const) {
    assertOpaqueId(id, field);
  }
  if (!run.requestId.trim() || !run.correlationId.trim()) throw new Error("run request and correlation IDs are required");
  if (!Number.isSafeInteger(run.attempt) || run.attempt < 1) throw new Error("run attempt must be positive");
}

export function assertEvidenceInvariant(evidence: EvidenceInvariant): void {
  assertOpaqueId(evidence.taskId, "taskId");
  if (evidence.runId) assertOpaqueId(evidence.runId, "runId");
  if (!evidence.type.trim() || !evidence.sourceRevision.trim() || !evidence.verificationState.trim()) {
    throw new Error("evidence type, provenance and verification state are required");
  }
  if (Number.isNaN(evidence.createdAt.getTime())) throw new Error("evidence creation time is invalid");
  if (!evidence.contentHash?.trim() && !evidence.externalReference?.trim()) {
    throw new Error("evidence requires a content hash or authoritative external reference");
  }
}

export function assertCostEntryInvariant(cost: CostEntryInvariant): void {
  assertOpaqueId(cost.runId, "runId");
  if (!COST_CLASSES.includes(cost.costClass)) throw new Error("invalid cost class");
  if (!Number.isFinite(cost.amount) || cost.amount < 0) throw new Error("cost amount must be non-negative");
  if (!/^[A-Z]{3}$/.test(cost.currency)) throw new Error("cost currency must be an ISO-style code");
  if (cost.priceSnapshotId) assertOpaqueId(cost.priceSnapshotId, "priceSnapshotId");
}

