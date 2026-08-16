import { assertOpaqueId } from "./invariants";

export interface StableRoleBinding {
  roleId: string;
  agentId: string;
  projectId: string | null;
  startsAt: Date;
  endsAt: Date | null;
}

export interface ProfileVersionInput {
  id: string;
  agentId: string;
  profileVersion: number;
  externalProfile: string;
  provider: string;
  model: string;
  billingMode: string;
  configurationHash: string;
  capabilities: readonly string[];
}

export interface ApprovedAgentProfile {
  key: string;
  displayName: string;
  role: string;
  responsibility: string;
  externalProfile: string;
  provider: "openai-codex" | "alibaba-token-plan";
  model: string;
  billingMode: "subscription" | "token-plan";
  capabilities: readonly string[];
}

export const APPROVED_AGENT_PROFILES: readonly ApprovedAgentProfile[] = [
  { key: "default", displayName: "Default", role: "router", responsibility: "General assistance and routing to specialists", externalProfile: "default", provider: "openai-codex", model: "gpt-5.6-luna", billingMode: "subscription", capabilities: ["triage", "routing"] },
  { key: "alfred", displayName: "Alfred", role: "assistant", responsibility: "Requests and consolidates reports, decisions and pending work", externalProfile: "alfred", provider: "openai-codex", model: "gpt-5.6-terra", billingMode: "subscription", capabilities: ["reporting", "coordination"] },
  { key: "spock", displayName: "Spock", role: "supervisor", responsibility: "Approves specifications, architecture, grants and final decisions", externalProfile: "spock", provider: "openai-codex", model: "gpt-5.6-sol", billingMode: "subscription", capabilities: ["specification", "architecture", "approval"] },
  { key: "b-elanna", displayName: "B’Elanna Torres", role: "implementer", responsibility: "Validates feasibility and develops backend, APIs and integrations", externalProfile: "b-elanna", provider: "alibaba-token-plan", model: "qwen3.8-max", billingMode: "token-plan", capabilities: ["backend", "api", "integration"] },
  { key: "seven", displayName: "Seven of Nine", role: "researcher", responsibility: "Researches alternatives, gaps and specification risks", externalProfile: "seven", provider: "openai-codex", model: "gpt-5.6-sol", billingMode: "subscription", capabilities: ["research", "risk-analysis"] },
  { key: "deanna", displayName: "Deanna Troi", role: "scope-reviewer", responsibility: "Validates intent, scope, impact and acceptance criteria", externalProfile: "deanna", provider: "openai-codex", model: "gpt-5.6-terra", billingMode: "subscription", capabilities: ["scope", "acceptance"] },
  { key: "la-forge", displayName: "Geordi La Forge", role: "architect", responsibility: "Leads complex and distributed implementations", externalProfile: "la-forge", provider: "alibaba-token-plan", model: "glm-5.2", billingMode: "token-plan", capabilities: ["architecture", "distributed-systems"] },
  { key: "barclay", displayName: "Reginald Barclay", role: "debugger", responsibility: "Diagnoses, reproduces and fixes isolated defects", externalProfile: "barclay", provider: "alibaba-token-plan", model: "deepseek-v4-flash-0731", billingMode: "token-plan", capabilities: ["debugging", "diagnostics"] },
  { key: "rutherford", displayName: "Rutherford", role: "tester", responsibility: "Owns tests, regression, CI and evidence validation", externalProfile: "rutherford", provider: "alibaba-token-plan", model: "deepseek-v4-flash-0731", billingMode: "token-plan", capabilities: ["testing", "ci"] },
  { key: "tuvok", displayName: "Tuvok", role: "reviewer", responsibility: "Performs independent security review and emergency revocation", externalProfile: "tuvok", provider: "alibaba-token-plan", model: "deepseek-v4-pro", billingMode: "token-plan", capabilities: ["security", "review"] },
  { key: "obrien", displayName: "Miles O’Brien", role: "operator", responsibility: "Handles operations, deployments, incidents and emergency controls", externalProfile: "obrien", provider: "alibaba-token-plan", model: "deepseek-v4-flash-0731", billingMode: "token-plan", capabilities: ["operations", "deployment"] },
  { key: "data", displayName: "Data", role: "data-specialist", responsibility: "Handles SQL, ledger analysis and cost reconciliation", externalProfile: "data", provider: "alibaba-token-plan", model: "qwen3.8-max", billingMode: "token-plan", capabilities: ["sql", "cost-analysis"] },
  { key: "bashir", displayName: "Julian Bashir", role: "database-security", responsibility: "Owns data-store security, migrations, backup and restoration", externalProfile: "bashir", provider: "openai-codex", model: "gpt-5.6-terra", billingMode: "subscription", capabilities: ["database", "backup"] },
  { key: "uhura", displayName: "Uhura", role: "documenter", responsibility: "Owns documentation, communication and evidence verification", externalProfile: "uhura", provider: "openai-codex", model: "gpt-5.6-luna", billingMode: "subscription", capabilities: ["documentation", "communication"] },
  { key: "crusher", displayName: "Beverly Crusher", role: "clinical-governance", responsibility: "Owns clinical governance, patient safety and critical health decisions", externalProfile: "crusher", provider: "openai-codex", model: "gpt-5.6-sol", billingMode: "subscription", capabilities: ["clinical-governance", "patient-safety"] }
] as const;

export interface AgentRoutingPolicy {
  projectId: string;
  taskKey?: string;
  agentKey: string;
  allowedCapabilities: readonly string[];
}

export function resolveApprovedAgent(input: { projectId: string; taskKey?: string; capability: string }, policies: readonly AgentRoutingPolicy[]): ApprovedAgentProfile {
  const applicable = policies.filter((policy) => policy.projectId === input.projectId && (!policy.taskKey || policy.taskKey === input.taskKey) && policy.allowedCapabilities.includes(input.capability));
  const taskSpecific = applicable.filter((policy) => policy.taskKey === input.taskKey);
  const selected = taskSpecific.length > 0 ? taskSpecific : applicable.filter((policy) => !policy.taskKey);
  if (selected.length !== 1) throw new Error(selected.length === 0 ? "no explicit agent policy permits this task" : "agent routing policy is ambiguous");
  const profile = APPROVED_AGENT_PROFILES.find(({ key }) => key === selected[0].agentKey);
  if (!profile || profile.key === "default") throw new Error("specialist policy must reference an approved non-default agent");
  if (!profile.capabilities.includes(input.capability)) throw new Error("agent profile does not advertise the required capability");
  return profile;
}

export function assertStableRoleBinding(binding: StableRoleBinding): void {
  assertOpaqueId(binding.roleId, "roleId");
  assertOpaqueId(binding.agentId, "agentId");
  if (binding.projectId) assertOpaqueId(binding.projectId, "projectId");
  if (Number.isNaN(binding.startsAt.getTime()) || (binding.endsAt && Number.isNaN(binding.endsAt.getTime()))) {
    throw new Error("role assignment dates must be valid");
  }
  if (binding.endsAt && binding.endsAt < binding.startsAt) throw new Error("role assignment end must not precede its start");
}

export function assertProfileVersion(profile: ProfileVersionInput): void {
  assertOpaqueId(profile.id, "profileVersionId");
  assertOpaqueId(profile.agentId, "agentId");
  if (!Number.isSafeInteger(profile.profileVersion) || profile.profileVersion < 1) throw new Error("profile version must be positive");
  for (const [field, value] of [["externalProfile", profile.externalProfile], ["provider", profile.provider], ["model", profile.model], ["billingMode", profile.billingMode]] as const) {
    if (!value.trim()) throw new Error(`${field} must not be blank`);
  }
  if (!/^[0-9a-f]{64}$/.test(profile.configurationHash)) throw new Error("configurationHash must be a lowercase SHA-256 digest");
  if (new Set(profile.capabilities).size !== profile.capabilities.length || profile.capabilities.some((value) => !value.trim())) {
    throw new Error("profile capabilities must be unique and non-blank");
  }
}
