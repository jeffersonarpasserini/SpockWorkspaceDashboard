import { describe, expect, it } from "vitest";
import {
  adaptProviderEvidence,
  createEvidence,
  createPolicy,
  evaluateQualityGates,
  recordHumanDecision,
  type EvidenceRecord
} from "./quality-gates";

const revision = "3eea0f79a6e956c18cb54cd5fc94f948b29d65ab";
const policy = createPolicy({
  id: "feature-policy",
  version: 2,
  taskType: "feature",
  gates: [
    { id: "tests", evidenceTypes: ["test", "ci"], minimumVerified: 1 },
    { id: "review", evidenceTypes: ["pull_request"], minimumVerified: 1 }
  ]
});

const evidence = (overrides: Partial<EvidenceRecord> = {}) => createEvidence({
  id: "evidence-1",
  version: 1,
  type: "test",
  taskId: "task-1",
  runId: "run-1",
  sourceRevision: revision,
  createdAt: "2026-08-16T19:00:00.000Z",
  verificationState: "verified",
  contentHash: "sha256:test",
  provider: "local",
  ...overrides
});

describe("evidence and quality gates", () => {
  it("keeps versioned evidence immutable and attributable", () => {
    const item = evidence();
    expect(Object.isFrozen(item)).toBe(true);
    expect(item).toMatchObject({ taskId: "task-1", runId: "run-1", sourceRevision: revision, version: 1 });
    expect(() => createEvidence({ ...item, id: "evidence-2", contentHash: undefined })).toThrow("content hash");
  });

  it("evaluates the exact policy version and source revision reproducibly", () => {
    const oldCi = evidence({ id: "old-ci", type: "ci", sourceRevision: "older" });
    const test = evidence();
    const review = evidence({ id: "review-1", type: "pull_request", contentHash: undefined, externalReference: "https://example.test/pr/1" });
    const result = evaluateQualityGates(policy, "task-1", revision, [oldCi, test, review]);
    expect(result).toMatchObject({ policyId: "feature-policy", policyVersion: 2, sourceRevision: revision, satisfied: true });
    expect(result.evaluatedEvidenceIds).toEqual(["evidence-1", "review-1"]);
    expect(evaluateQualityGates(policy, "task-1", revision, [oldCi, review])).toMatchObject({ satisfied: false });
  });

  it("proves successful agent output cannot directly accept work", () => {
    const result = evaluateQualityGates(policy, "task-1", revision, [evidence()]);
    const decision = {
      id: "decision-1", action: "accept" as const, actorId: "spock-agent", actorKind: "agent" as const,
      taskId: "task-1", sourceRevision: revision, policyId: policy.id, policyVersion: policy.version,
      evidenceIds: result.evaluatedEvidenceIds, reason: "run succeeded", decidedAt: "2026-08-16T20:00:00.000Z"
    };
    expect(() => recordHumanDecision(decision, result)).toThrow("Only an authorized human");
    expect(() => recordHumanDecision({ ...decision, actorId: "owner-1", actorKind: "human" }, result)).toThrow("Unsatisfied quality gates");
  });

  it("records human accept and rework decisions with exact policy and evidence", () => {
    const test = evidence();
    const review = evidence({ id: "review-1", type: "pull_request", contentHash: undefined, externalReference: "https://example.test/pr/1" });
    const result = evaluateQualityGates(policy, "task-1", revision, [test, review]);
    const accepted = recordHumanDecision({
      id: "decision-1", action: "accept", actorId: "owner-1", actorKind: "human", taskId: "task-1",
      sourceRevision: revision, policyId: policy.id, policyVersion: policy.version,
      evidenceIds: result.evaluatedEvidenceIds, reason: "reviewed exact revision", decidedAt: "2026-08-16T20:00:00.000Z"
    }, result);
    expect(accepted).toMatchObject({ action: "accept", actorId: "owner-1", policyVersion: 2 });
    expect(recordHumanDecision({ ...accepted, id: "decision-2", action: "rework", reason: "additional hardening required" }, result)).toMatchObject({ action: "rework" });
  });

  it("does not claim CI or release when optional provider facts are unavailable", () => {
    for (const provider of ["github", "gitlab"] as const) {
      const unavailable = adaptProviderEvidence({ provider, taskId: "task-1", sourceRevision: revision, observedAt: "2026-08-16T20:00:00.000Z" });
      expect(unavailable.evidence).toEqual([]);
      expect(unavailable.capabilities).toMatchObject({ ci: "unavailable", release: "unavailable" });
    }
    const observed = adaptProviderEvidence({
      provider: "github", taskId: "task-1", sourceRevision: revision, observedAt: "2026-08-16T20:00:00.000Z",
      commitUrl: "https://github.test/commit/1", ci: { state: "success", url: "https://github.test/actions/1" },
      release: { deployed: false, url: "https://github.test/releases/1" }
    });
    expect(observed.evidence.map((item) => [item.type, item.verificationState])).toEqual([
      ["commit", "verified"], ["ci", "verified"], ["deployment", "pending"]
    ]);
  });
});
