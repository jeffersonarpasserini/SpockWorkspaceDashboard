import { describe, expect, it } from "vitest";
import { assertAssignmentInvariant, assertCostEntryInvariant, assertEvidenceInvariant, assertRunInvariant, assertStableTaskIdentity, assertWorkflowVersionInvariant } from "./invariants";
import { assertTaskTransition } from "./lifecycle";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("control-plane domain invariants", () => {
  it("requires durable project and task identity independently from display text", () => {
    expect(() => assertStableTaskIdentity(id("1"), id("2"), "change/task/1.1")).not.toThrow();
    expect(() => assertStableTaskIdentity("mutable-title", id("2"), "change/task/1.1")).toThrow("opaque");
    expect(() => assertStableTaskIdentity(id("1"), id("2"), " ")).toThrow("stableKey");
  });

  it("keeps assignments project-scoped and temporally ordered", () => {
    const assignment = { projectId: id("1"), taskId: id("2"), roleId: id("3"), startsAt: new Date("2026-08-15T10:00:00Z"), endsAt: null };
    expect(() => assertAssignmentInvariant(assignment)).not.toThrow();
    expect(() => assertAssignmentInvariant({ ...assignment, endsAt: new Date("2026-08-15T09:00:00Z") })).toThrow("precede");
  });

  it("requires versioned workflows, explicit roles, transitions, correction bounds and approval gates", () => {
    const workflow = { templateId: id("1"), version: 1, roles: ["implementer"], transitions: [{ from: "implement", to: "validate" }], correctionLimit: 2, approvalGates: ["human_acceptance"] };
    expect(() => assertWorkflowVersionInvariant(workflow)).not.toThrow();
    expect(() => assertWorkflowVersionInvariant({ ...workflow, correctionLimit: 3 })).toThrow("zero and two");
    expect(() => assertWorkflowVersionInvariant({ ...workflow, approvalGates: [] })).toThrow("approval gates");
  });

  it("binds every run to the exact agent profile snapshot and correlation identifiers", () => {
    const run = { taskId: id("1"), agentId: id("2"), agentProfileVersionId: id("3"), requestId: "request-1", correlationId: "correlation-1", attempt: 1 };
    expect(() => assertRunInvariant(run)).not.toThrow();
    expect(() => assertRunInvariant({ ...run, agentProfileVersionId: "la-forge-current" })).toThrow("opaque");
  });

  it("requires attributable, verifiable evidence", () => {
    const evidence = { type: "test", taskId: id("1"), runId: id("2"), sourceRevision: "abc123", createdAt: new Date("2026-08-15T10:00:00Z"), verificationState: "verified", contentHash: "sha256:abc", externalReference: null };
    expect(() => assertEvidenceInvariant(evidence)).not.toThrow();
    expect(() => assertEvidenceInvariant({ ...evidence, contentHash: null })).toThrow("content hash");
  });

  it("preserves cost classes and their price snapshot attribution", () => {
    expect(() => assertCostEntryInvariant({ runId: id("1"), costClass: "simulated", amount: 1.25, currency: "USD", priceSnapshotId: id("2") })).not.toThrow();
    expect(() => assertCostEntryInvariant({ runId: id("1"), costClass: "actual", amount: -1, currency: "USD", priceSnapshotId: null })).toThrow("non-negative");
  });

  it("does not let run success skip validation and human acceptance", () => {
    expect(() => assertTaskTransition("implemented", "accepted")).toThrow("Invalid task transition");
    expect(() => assertTaskTransition("implemented", "validating")).not.toThrow();
  });
});
