import { describe, expect, it } from "vitest";
import { completeManualNode, createManualWorkflow, requestCorrection, WORKFLOW_TEMPLATES } from "./templates";

describe("manual workflow templates", () => {
  it("defines immutable feature, bug, infrastructure and analysis workflows with risk branches", () => {
    expect(Object.keys(WORKFLOW_TEMPLATES)).toEqual(["feature", "bug", "infrastructure", "analysis"]);
    expect(Object.values(WORKFLOW_TEMPLATES).every(({ version, correctionLimit }) => version === 1 && correctionLimit === 2)).toBe(true);
    expect(WORKFLOW_TEMPLATES.infrastructure.steps.find(({ key }) => key === "execute")).toMatchObject({ role: "operator", destructiveRisk: true, requiresHumanApproval: true });
    expect(Object.isFrozen(WORKFLOW_TEMPLATES.feature.steps)).toBe(true);
  });

  it("runs only as manual state and creates a human blocker after two corrections", () => {
    const [first] = createManualWorkflow("feature");
    const once = requestCorrection(first, "tests failed");
    const twice = requestCorrection(once, "review failed");
    const exhausted = requestCorrection(twice, "security review failed");
    expect(once).toMatchObject({ correctionCount: 1, status: "waiting" });
    expect(twice).toMatchObject({ correctionCount: 2, status: "waiting" });
    expect(exhausted).toMatchObject({ correctionCount: 3, status: "blocked", blocker: "human_review_required:security review failed" });
  });

  it("preserves the complete handoff record on completion", () => {
    const [node] = createManualWorkflow("analysis");
    const handoff = { objective: "Reconcile costs", inputs: ["ledger-v1"], outputSummary: "No divergence", evidence: ["report:1"], sourceRevision: "abc123", actor: "data" };
    expect(completeManualNode(node, handoff)).toMatchObject({ status: "completed", handoff });
    expect(() => completeManualNode(node, { ...handoff, evidence: [""] })).toThrow(/collections/);
  });
});

