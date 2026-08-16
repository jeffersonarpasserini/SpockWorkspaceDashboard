export const RUNTIME_DATA_CLASSES = [
  "domain_events",
  "runs_and_turns",
  "sessions",
  "usage_and_costs",
  "audit_events",
  "observations_and_traces",
  "application_and_container_logs",
  "ephemeral_worktrees",
  "workspace_exports",
  "backups"
] as const;

export type RuntimeDataClass = (typeof RUNTIME_DATA_CLASSES)[number];
export type RetentionAuthority = "control_plane" | "orchestrator" | "hermes" | "observability" | "filesystem" | "backup_operator";
export type DataClassification = "operational" | "confidential" | "financial" | "security_audit";
export type ConfirmationMode = "owned" | "external_confirmation";

export interface RetentionRule {
  dataClass: RuntimeDataClass;
  revision: 1;
  authority: RetentionAuthority;
  classification: DataClassification;
  clock: "recorded_at" | "terminal_at" | "last_activity_at" | "created_at" | "generation_at";
  activeDays: number;
  tombstoneDays: number;
  purgeWithinDays: number;
  confirmation: ConfirmationMode;
  derivedCopies: readonly RuntimeDataClass[];
}

export const RETENTION_MATRIX: readonly RetentionRule[] = [
  { dataClass: "domain_events", revision: 1, authority: "control_plane", classification: "operational", clock: "recorded_at", activeDays: 365, tombstoneDays: 365, purgeWithinDays: 30, confirmation: "owned", derivedCopies: ["workspace_exports", "backups"] },
  { dataClass: "runs_and_turns", revision: 1, authority: "control_plane", classification: "confidential", clock: "terminal_at", activeDays: 365, tombstoneDays: 365, purgeWithinDays: 30, confirmation: "owned", derivedCopies: ["observations_and_traces", "workspace_exports", "backups"] },
  { dataClass: "sessions", revision: 1, authority: "hermes", classification: "confidential", clock: "last_activity_at", activeDays: 90, tombstoneDays: 365, purgeWithinDays: 30, confirmation: "external_confirmation", derivedCopies: ["observations_and_traces", "backups"] },
  { dataClass: "usage_and_costs", revision: 1, authority: "control_plane", classification: "financial", clock: "recorded_at", activeDays: 2555, tombstoneDays: 365, purgeWithinDays: 30, confirmation: "owned", derivedCopies: ["workspace_exports", "backups"] },
  { dataClass: "audit_events", revision: 1, authority: "control_plane", classification: "security_audit", clock: "recorded_at", activeDays: 730, tombstoneDays: 365, purgeWithinDays: 30, confirmation: "owned", derivedCopies: ["backups"] },
  { dataClass: "observations_and_traces", revision: 1, authority: "observability", classification: "confidential", clock: "recorded_at", activeDays: 30, tombstoneDays: 30, purgeWithinDays: 7, confirmation: "external_confirmation", derivedCopies: ["backups"] },
  { dataClass: "application_and_container_logs", revision: 1, authority: "observability", classification: "operational", clock: "recorded_at", activeDays: 30, tombstoneDays: 0, purgeWithinDays: 7, confirmation: "external_confirmation", derivedCopies: [] },
  { dataClass: "ephemeral_worktrees", revision: 1, authority: "filesystem", classification: "confidential", clock: "terminal_at", activeDays: 7, tombstoneDays: 0, purgeWithinDays: 1, confirmation: "owned", derivedCopies: [] },
  { dataClass: "workspace_exports", revision: 1, authority: "control_plane", classification: "confidential", clock: "created_at", activeDays: 30, tombstoneDays: 30, purgeWithinDays: 7, confirmation: "owned", derivedCopies: ["backups"] },
  { dataClass: "backups", revision: 1, authority: "backup_operator", classification: "confidential", clock: "generation_at", activeDays: 90, tombstoneDays: 30, purgeWithinDays: 7, confirmation: "external_confirmation", derivedCopies: [] }
] as const;

export function validateRetentionMatrix(rules: readonly RetentionRule[]): void {
  const expected = new Set<string>(RUNTIME_DATA_CLASSES);
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!expected.has(rule.dataClass)) throw new Error(`unknown retention data class: ${rule.dataClass}`);
    if (seen.has(rule.dataClass)) throw new Error(`duplicate retention rule: ${rule.dataClass}`);
    seen.add(rule.dataClass);
    for (const [name, value] of [["activeDays", rule.activeDays], ["tombstoneDays", rule.tombstoneDays], ["purgeWithinDays", rule.purgeWithinDays]] as const) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
    }
    if (rule.purgeWithinDays < 1) throw new Error("purgeWithinDays must be positive");
    if (new Set(rule.derivedCopies).size !== rule.derivedCopies.length) throw new Error(`duplicate derived copy: ${rule.dataClass}`);
    if (rule.derivedCopies.includes(rule.dataClass)) throw new Error(`retention rule cannot derive itself: ${rule.dataClass}`);
  }
  const missing = RUNTIME_DATA_CLASSES.filter((dataClass) => !seen.has(dataClass));
  if (missing.length > 0) throw new Error(`missing retention rules: ${missing.join(", ")}`);
}

export interface RetentionHold {
  id: string;
  startsAt: Date;
  expiresAt: Date;
  authorizedBy: string;
  reasonCode: string;
}

export type RetentionState = "active" | "expired" | "tombstoned" | "purge_due" | "held";

export interface RetentionDecision {
  dataClass: RuntimeDataClass;
  policyRevision: number;
  state: RetentionState;
  contentExpiresAt: Date;
  tombstoneExpiresAt: Date;
  purgeDeadline: Date;
  activeHoldIds: readonly string[];
  requiresExternalConfirmation: boolean;
}

const DAY_MS = 86_400_000;

export function planRetention(rule: RetentionRule, clockStartedAt: Date, now: Date, holds: readonly RetentionHold[] = []): RetentionDecision {
  if (Number.isNaN(clockStartedAt.getTime()) || Number.isNaN(now.getTime())) throw new Error("retention dates must be valid");
  const activeHoldIds = holds.filter((hold) => {
    if (!hold.id || !hold.authorizedBy || !hold.reasonCode || Number.isNaN(hold.startsAt.getTime()) || Number.isNaN(hold.expiresAt.getTime()) || hold.expiresAt <= hold.startsAt) {
      throw new Error("retention hold must be scoped, authorized, justified and time-bounded");
    }
    return hold.startsAt <= now && hold.expiresAt > now;
  }).map(({ id }) => id).sort();
  const contentExpiresAt = new Date(clockStartedAt.getTime() + rule.activeDays * DAY_MS);
  const tombstoneExpiresAt = new Date(contentExpiresAt.getTime() + rule.tombstoneDays * DAY_MS);
  const purgeDeadline = new Date(tombstoneExpiresAt.getTime() + rule.purgeWithinDays * DAY_MS);
  let state: RetentionState = "active";
  if (activeHoldIds.length > 0 && now >= contentExpiresAt) state = "held";
  else if (now >= purgeDeadline) state = "purge_due";
  else if (now >= tombstoneExpiresAt) state = "tombstoned";
  else if (now >= contentExpiresAt) state = "expired";
  return { dataClass: rule.dataClass, policyRevision: rule.revision, state, contentExpiresAt, tombstoneExpiresAt, purgeDeadline, activeHoldIds, requiresExternalConfirmation: rule.confirmation === "external_confirmation" };
}

validateRetentionMatrix(RETENTION_MATRIX);

