export const EVIDENCE_TYPES = [
  "commit", "diff", "pull_request", "test", "ci", "coverage", "document", "screenshot",
  "video", "deployment", "trace", "human_approval"
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type VerificationState = "verified" | "failed" | "pending" | "unavailable";
export type TaskType = "feature" | "bug" | "infrastructure" | "analysis";

export interface EvidenceRecord {
  id: string;
  version: number;
  type: EvidenceType;
  taskId: string;
  runId?: string;
  sourceRevision: string;
  createdAt: string;
  verificationState: VerificationState;
  contentHash?: string;
  externalReference?: string;
  provider?: "github" | "gitlab" | "local";
}

export interface GateRequirement {
  id: string;
  evidenceTypes: readonly EvidenceType[];
  minimumVerified: number;
}

export interface QualityPolicy {
  id: string;
  version: number;
  taskType: TaskType;
  gates: readonly GateRequirement[];
}

export interface GateResult {
  gateId: string;
  satisfied: boolean;
  evidenceIds: readonly string[];
  missing: string;
}

export interface GateEvaluation {
  taskId: string;
  sourceRevision: string;
  policyId: string;
  policyVersion: number;
  satisfied: boolean;
  results: readonly GateResult[];
  evaluatedEvidenceIds: readonly string[];
}

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

export function createEvidence(record: EvidenceRecord): Readonly<EvidenceRecord> {
  requireText(record.id, "evidence id");
  requireText(record.taskId, "task id");
  requireText(record.sourceRevision, "source revision");
  if (!Number.isSafeInteger(record.version) || record.version < 1) throw new Error("Evidence version must be positive");
  if (!record.contentHash?.trim() && !record.externalReference?.trim()) {
    throw new Error("Evidence requires a content hash or authoritative external reference");
  }
  if (!Number.isFinite(Date.parse(record.createdAt))) throw new Error("Evidence timestamp is invalid");
  return Object.freeze({ ...record });
}

export function createPolicy(policy: QualityPolicy): Readonly<QualityPolicy> {
  requireText(policy.id, "policy id");
  if (!Number.isSafeInteger(policy.version) || policy.version < 1) throw new Error("Policy version must be positive");
  if (policy.gates.length === 0) throw new Error("Policy must define at least one gate");
  const ids = new Set<string>();
  const gates = policy.gates.map((gate) => {
    requireText(gate.id, "gate id");
    if (ids.has(gate.id)) throw new Error(`Duplicate gate id: ${gate.id}`);
    ids.add(gate.id);
    if (!Number.isSafeInteger(gate.minimumVerified) || gate.minimumVerified < 1) {
      throw new Error("Gate minimumVerified must be positive");
    }
    if (gate.evidenceTypes.length === 0) throw new Error("Gate evidence types are required");
    return Object.freeze({ ...gate, evidenceTypes: Object.freeze([...gate.evidenceTypes]) });
  });
  return Object.freeze({ ...policy, gates: Object.freeze(gates) });
}

export function evaluateQualityGates(
  policy: QualityPolicy,
  taskId: string,
  sourceRevision: string,
  evidence: readonly EvidenceRecord[]
): GateEvaluation {
  const exactEvidence = evidence.filter((item) => item.taskId === taskId && item.sourceRevision === sourceRevision);
  const results = policy.gates.map((gate): GateResult => {
    const matching = exactEvidence.filter((item) =>
      item.verificationState === "verified" && gate.evidenceTypes.includes(item.type)
    );
    return {
      gateId: gate.id,
      satisfied: matching.length >= gate.minimumVerified,
      evidenceIds: matching.map((item) => item.id),
      missing: matching.length >= gate.minimumVerified
        ? ""
        : `requires ${gate.minimumVerified} verified ${gate.evidenceTypes.join(" or ")} evidence item(s) for revision ${sourceRevision}`
    };
  });
  return Object.freeze({
    taskId,
    sourceRevision,
    policyId: policy.id,
    policyVersion: policy.version,
    satisfied: results.every((result) => result.satisfied),
    results: Object.freeze(results),
    evaluatedEvidenceIds: Object.freeze(exactEvidence.map((item) => item.id))
  });
}

export interface HumanDecision {
  id: string;
  action: "accept" | "rework";
  actorId: string;
  actorKind: "human" | "agent" | "service";
  taskId: string;
  sourceRevision: string;
  policyId: string;
  policyVersion: number;
  evidenceIds: readonly string[];
  reason: string;
  decidedAt: string;
  expiresAt?: string;
}

export function recordHumanDecision(decision: HumanDecision, evaluation: GateEvaluation): Readonly<HumanDecision> {
  if (decision.actorKind !== "human") throw new Error("Only an authorized human can accept or request rework");
  requireText(decision.actorId, "human actor");
  requireText(decision.reason, "decision reason");
  if (decision.taskId !== evaluation.taskId || decision.sourceRevision !== evaluation.sourceRevision) {
    throw new Error("Decision scope does not match gate evaluation");
  }
  if (decision.policyId !== evaluation.policyId || decision.policyVersion !== evaluation.policyVersion) {
    throw new Error("Decision policy does not match gate evaluation");
  }
  if (decision.action === "accept" && !evaluation.satisfied) throw new Error("Unsatisfied quality gates prohibit acceptance");
  if (decision.action === "accept" && !evaluation.evaluatedEvidenceIds.every((id) => decision.evidenceIds.includes(id))) {
    throw new Error("Acceptance must retain the evaluated evidence set");
  }
  if (!Number.isFinite(Date.parse(decision.decidedAt))) throw new Error("Decision timestamp is invalid");
  if (decision.expiresAt && Date.parse(decision.expiresAt) <= Date.parse(decision.decidedAt)) {
    throw new Error("Decision expiry must follow the decision time");
  }
  return Object.freeze({ ...decision, evidenceIds: Object.freeze([...decision.evidenceIds]) });
}

export interface ProviderEvidenceSnapshot {
  provider: "github" | "gitlab";
  taskId: string;
  sourceRevision: string;
  observedAt: string;
  commitUrl?: string;
  pullRequestUrl?: string;
  ci?: { state: "success" | "failed" | "pending"; url: string };
  release?: { deployed: boolean; url: string };
}

export interface ProviderEvidenceResult {
  evidence: readonly Readonly<EvidenceRecord>[];
  capabilities: {
    commit: "observed" | "unavailable";
    pullRequest: "observed" | "unavailable";
    ci: "observed" | "unavailable";
    release: "observed" | "unavailable";
  };
}

export function adaptProviderEvidence(snapshot: ProviderEvidenceSnapshot): ProviderEvidenceResult {
  let sequence = 0;
  const evidence: Readonly<EvidenceRecord>[] = [];
  const add = (type: EvidenceType, externalReference: string, verificationState: VerificationState) => {
    sequence += 1;
    evidence.push(createEvidence({
      id: `${snapshot.provider}:${snapshot.sourceRevision}:${type}:${sequence}`,
      version: 1,
      type,
      taskId: snapshot.taskId,
      sourceRevision: snapshot.sourceRevision,
      createdAt: snapshot.observedAt,
      verificationState,
      externalReference,
      provider: snapshot.provider
    }));
  };
  if (snapshot.commitUrl) add("commit", snapshot.commitUrl, "verified");
  if (snapshot.pullRequestUrl) add("pull_request", snapshot.pullRequestUrl, "verified");
  if (snapshot.ci) add("ci", snapshot.ci.url, snapshot.ci.state === "success" ? "verified" : snapshot.ci.state);
  if (snapshot.release) add("deployment", snapshot.release.url, snapshot.release.deployed ? "verified" : "pending");
  return {
    evidence: Object.freeze(evidence),
    capabilities: {
      commit: snapshot.commitUrl ? "observed" : "unavailable",
      pullRequest: snapshot.pullRequestUrl ? "observed" : "unavailable",
      ci: snapshot.ci ? "observed" : "unavailable",
      release: snapshot.release ? "observed" : "unavailable"
    }
  };
}
