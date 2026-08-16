import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const HUMAN_ROLES = ["owner", "admin", "operator", "reviewer", "viewer"] as const;
export type HumanRole = (typeof HUMAN_ROLES)[number];
export type ProtectedAction =
  | "read" | "stream" | "mutate" | "execute" | "review" | "approve"
  | "manage_budget" | "manage_policy" | "manage_secrets";

const ROLE_ACTIONS: Readonly<Record<HumanRole, readonly ProtectedAction[]>> = {
  owner: ["read", "stream", "mutate", "execute", "review", "approve", "manage_budget", "manage_policy", "manage_secrets"],
  admin: ["read", "stream", "mutate", "execute", "review", "approve", "manage_budget", "manage_policy", "manage_secrets"],
  operator: ["read", "stream", "mutate", "execute"],
  reviewer: ["read", "stream", "review", "approve"],
  viewer: ["read", "stream"]
};

export interface ScopeGrant {
  workspaceId: string;
  projectIds: readonly string[] | "*";
  role: HumanRole;
}

export type Principal =
  | { kind: "human"; id: string; authenticated: boolean; grants: readonly ScopeGrant[] }
  | { kind: "service"; id: string; authenticated: boolean; workspaceId: string; projectIds: readonly string[]; actionScopes: readonly ProtectedAction[] }
  | { kind: "agent"; id: string; authenticated: boolean; workspaceId: string; projectId: string; actionScopes: readonly ProtectedAction[] };

export interface AuthorizationRequest {
  workspaceId: string;
  projectId?: string;
  action: ProtectedAction;
}

export function authorize(principal: Principal | undefined, request: AuthorizationRequest): void {
  if (!principal?.authenticated) throw new Error("Authentication required");
  if (principal.kind === "human") {
    const grant = principal.grants.find((candidate) => candidate.workspaceId === request.workspaceId
      && (!request.projectId || candidate.projectIds === "*" || candidate.projectIds.includes(request.projectId)));
    if (!grant || !ROLE_ACTIONS[grant.role].includes(request.action)) throw new Error("Workspace/project action is not authorized");
    return;
  }
  if (principal.workspaceId !== request.workspaceId || !principal.actionScopes.includes(request.action)) {
    throw new Error("Workspace/project action is not authorized");
  }
  if (request.projectId) {
    const allowed = principal.kind === "agent" ? principal.projectId === request.projectId : principal.projectIds.includes(request.projectId);
    if (!allowed) throw new Error("Workspace/project action is not authorized");
  }
}

function equalSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCsrf(sessionToken: string, cookieToken: string | undefined, headerToken: string | undefined): void {
  if (!cookieToken || !headerToken || !equalSecret(cookieToken, headerToken)) throw new Error("CSRF token mismatch");
  const expected = createHmac("sha256", sessionToken).update("spock-csrf-v1").digest("hex");
  if (!equalSecret(expected, cookieToken)) throw new Error("CSRF token is not bound to the session");
}

export function csrfToken(sessionToken: string): string {
  return createHmac("sha256", sessionToken).update("spock-csrf-v1").digest("hex");
}

export function assertOptimisticVersion(expected: number, actual: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1 || expected !== actual) throw new Error("Optimistic version conflict");
}

export class IdempotencyRegistry {
  readonly #requests = new Map<string, string>();

  claim(scope: string, key: string, payload: string): "claimed" | "replayed" {
    if (!scope.trim() || !key.trim()) throw new Error("Idempotency scope and key are required");
    const identity = `${scope}\u0000${key}`;
    const digest = createHash("sha256").update(payload).digest("hex");
    const existing = this.#requests.get(identity);
    if (existing && existing !== digest) throw new Error("Idempotency key reused with different payload");
    if (existing) return "replayed";
    this.#requests.set(identity, digest);
    return "claimed";
  }
}

export function signWebhook(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifySignedWebhook(body: string, signature: string | undefined, secret: string): void {
  if (!signature || !equalSecret(signWebhook(body, secret), signature)) throw new Error("Invalid provider webhook signature");
}

export interface SecretReference {
  id: string;
  version: number;
  encryptedReference: `enc:v1:${string}`;
  allowedChildIds: readonly string[];
  environmentVariable: string;
}

export type SecretResolver = (encryptedReference: string) => string;

export class SecretReferenceRegistry {
  readonly #versions = new Map<string, readonly Readonly<SecretReference>[] >();

  register(reference: SecretReference): Readonly<SecretReference> {
    if (!reference.encryptedReference.startsWith("enc:v1:")) throw new Error("Secret reference must be encrypted");
    if (!Number.isSafeInteger(reference.version) || reference.version < 1) throw new Error("Secret reference version must be positive");
    const existing = this.#versions.get(reference.id) ?? [];
    const expectedVersion = existing.length + 1;
    if (reference.version !== expectedVersion) throw new Error(`Secret reference version must be ${expectedVersion}`);
    const stored = Object.freeze({ ...reference, allowedChildIds: Object.freeze([...reference.allowedChildIds]) });
    this.#versions.set(reference.id, Object.freeze([...existing, stored]));
    return stored;
  }

  versions(id: string): readonly Readonly<SecretReference>[] {
    return this.#versions.get(id) ?? [];
  }
}

export function injectSecret(reference: SecretReference, childId: string, resolver: SecretResolver): Readonly<Record<string, string>> {
  if (!reference.encryptedReference.startsWith("enc:v1:")) throw new Error("Secret reference must be encrypted");
  if (!reference.allowedChildIds.includes(childId)) throw new Error("Child process is not approved for secret reference");
  if (!/^[A-Z][A-Z0-9_]*$/.test(reference.environmentVariable)) throw new Error("Secret environment variable is invalid");
  const value = resolver(reference.encryptedReference);
  if (!value) throw new Error("Secret resolver returned an empty value");
  return Object.freeze({ [reference.environmentVariable]: value });
}

export function redactSensitive(value: string, resolvedSecrets: readonly string[] = []): string {
  let redacted = value;
  for (const secret of resolvedSecrets.filter(Boolean)) redacted = redacted.split(secret).join("[REDACTED]");
  return redacted
    .replace(/(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/enc:v1:[A-Za-z0-9+/=_-]+/g, "[ENCRYPTED_REFERENCE]");
}

export interface HookDefinition {
  id: string;
  version: number;
  content: string;
}

export interface HookApproval {
  hookId: string;
  version: number;
  contentHash: string;
  approverId: string;
  approvedAt: string;
}

export function hashHook(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function approveHook(hook: HookDefinition, approverId: string, approvedAt: string): Readonly<HookApproval> {
  if (!approverId.trim()) throw new Error("Hook approver is required");
  if (!Number.isSafeInteger(hook.version) || hook.version < 1 || !hook.content.trim()) throw new Error("Hook version and content are required");
  return Object.freeze({ hookId: hook.id, version: hook.version, contentHash: hashHook(hook.content), approverId, approvedAt });
}

export function authorizeHookExecution(hook: HookDefinition, approval: HookApproval | undefined): void {
  if (!approval || approval.hookId !== hook.id || approval.version !== hook.version || approval.contentHash !== hashHook(hook.content)) {
    throw new Error("Hook requires explicit approval for its current version and hash");
  }
}

export const AUDIT_ACTIONS = [
  "mutation", "dispatch", "approval", "budget_change", "policy_change", "secret_reference_change"
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEvent {
  id: string;
  sequence: number;
  action: AuditAction;
  actorId: string;
  workspaceId: string;
  projectId?: string;
  occurredAt: string;
  outcome: "allowed" | "denied" | "failed";
  details: string;
}

export class AppendOnlyAuditLog {
  readonly #events: Readonly<AuditEvent>[] = [];

  append(event: Readonly<AuditEvent>): void {
    const expected = this.#events.length + 1;
    if (event.sequence !== expected) throw new Error(`Audit sequence must be ${expected}`);
    if (this.#events.some((existing) => existing.id === event.id)) throw new Error("Duplicate audit event id");
    this.#events.push(event);
  }

  events(): readonly Readonly<AuditEvent>[] {
    return [...this.#events];
  }
}

export function createAuditEvent(event: AuditEvent, secrets: readonly string[] = []): Readonly<AuditEvent> {
  if (!event.actorId.trim() || !event.workspaceId.trim()) throw new Error("Audit actor and workspace are required");
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error("Audit sequence must be positive");
  return Object.freeze({ ...event, details: redactSensitive(event.details, secrets) });
}
