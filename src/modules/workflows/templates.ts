import type { TeamRole } from "../control-plane/domain";

export type WorkflowKind = "feature" | "bug" | "infrastructure" | "analysis";
export type WorkflowNodeStatus = "planned" | "waiting" | "running" | "blocked" | "completed";

export interface WorkflowStepDefinition {
  key: string;
  role: TeamRole;
  dependsOn: readonly string[];
  destructiveRisk: boolean;
  requiresHumanApproval: boolean;
}

export interface WorkflowTemplate {
  kind: WorkflowKind;
  version: 1;
  correctionLimit: 2;
  steps: readonly WorkflowStepDefinition[];
}

const templates: Record<WorkflowKind, WorkflowTemplate> = {
  feature: { kind: "feature", version: 1, correctionLimit: 2, steps: [
    { key: "scope", role: "supervisor", dependsOn: [], destructiveRisk: false, requiresHumanApproval: false },
    { key: "design", role: "architect", dependsOn: ["scope"], destructiveRisk: false, requiresHumanApproval: false },
    { key: "implement", role: "implementer", dependsOn: ["design"], destructiveRisk: false, requiresHumanApproval: false },
    { key: "test", role: "tester", dependsOn: ["implement"], destructiveRisk: false, requiresHumanApproval: false },
    { key: "review", role: "reviewer", dependsOn: ["test"], destructiveRisk: false, requiresHumanApproval: true }
  ] },
  bug: { kind: "bug", version: 1, correctionLimit: 2, steps: [
    { key: "reproduce", role: "debugger", dependsOn: [], destructiveRisk: false, requiresHumanApproval: false },
    { key: "fix", role: "implementer", dependsOn: ["reproduce"], destructiveRisk: false, requiresHumanApproval: false },
    { key: "regression", role: "tester", dependsOn: ["fix"], destructiveRisk: false, requiresHumanApproval: false },
    { key: "review", role: "reviewer", dependsOn: ["regression"], destructiveRisk: false, requiresHumanApproval: true }
  ] },
  infrastructure: { kind: "infrastructure", version: 1, correctionLimit: 2, steps: [
    { key: "plan", role: "architect", dependsOn: [], destructiveRisk: false, requiresHumanApproval: false },
    { key: "verify", role: "reviewer", dependsOn: ["plan"], destructiveRisk: false, requiresHumanApproval: false },
    { key: "execute", role: "operator", dependsOn: ["verify"], destructiveRisk: true, requiresHumanApproval: true },
    { key: "validate", role: "tester", dependsOn: ["execute"], destructiveRisk: false, requiresHumanApproval: true }
  ] },
  analysis: { kind: "analysis", version: 1, correctionLimit: 2, steps: [
    { key: "analyze", role: "data-specialist", dependsOn: [], destructiveRisk: false, requiresHumanApproval: false },
    { key: "review", role: "reviewer", dependsOn: ["analyze"], destructiveRisk: false, requiresHumanApproval: true }
  ] }
};

function freezeTemplate(template: WorkflowTemplate): WorkflowTemplate {
  return Object.freeze({ ...template, steps: Object.freeze(template.steps.map((step) => Object.freeze({ ...step, dependsOn: Object.freeze([...step.dependsOn]) }))) });
}

export const WORKFLOW_TEMPLATES: Readonly<Record<WorkflowKind, WorkflowTemplate>> = Object.freeze({
  feature: freezeTemplate(templates.feature),
  bug: freezeTemplate(templates.bug),
  infrastructure: freezeTemplate(templates.infrastructure),
  analysis: freezeTemplate(templates.analysis)
});

export interface WorkflowHandoff {
  objective: string;
  inputs: readonly string[];
  outputSummary: string;
  evidence: readonly string[];
  sourceRevision: string;
  actor: string;
}

export function validateHandoff(handoff: WorkflowHandoff): void {
  for (const [field, value] of [["objective", handoff.objective], ["outputSummary", handoff.outputSummary], ["sourceRevision", handoff.sourceRevision], ["actor", handoff.actor]] as const) {
    if (!value.trim()) throw new Error(`workflow handoff ${field} is required`);
  }
  if (handoff.inputs.some((value) => !value.trim()) || handoff.evidence.some((value) => !value.trim())) throw new Error("workflow handoff collections cannot contain blanks");
}

export interface ManualWorkflowNode {
  key: string;
  status: WorkflowNodeStatus;
  correctionCount: number;
  blocker: string | null;
  handoff: WorkflowHandoff | null;
}

export function createManualWorkflow(kind: WorkflowKind): readonly ManualWorkflowNode[] {
  return WORKFLOW_TEMPLATES[kind].steps.map((step, index) => ({ key: step.key, status: index === 0 ? "waiting" : "planned", correctionCount: 0, blocker: null, handoff: null }));
}

export function requestCorrection(node: ManualWorkflowNode, reason: string, limit = 2): ManualWorkflowNode {
  if (!reason.trim()) throw new Error("correction reason is required");
  const correctionCount = node.correctionCount + 1;
  return correctionCount > limit
    ? { ...node, correctionCount, status: "blocked", blocker: `human_review_required:${reason}` }
    : { ...node, correctionCount, status: "waiting", blocker: null };
}

export function completeManualNode(node: ManualWorkflowNode, handoff: WorkflowHandoff): ManualWorkflowNode {
  validateHandoff(handoff);
  if (node.status === "blocked") throw new Error("blocked workflow node requires human resolution");
  return { ...node, status: "completed", handoff: structuredClone(handoff) };
}
