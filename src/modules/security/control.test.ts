import { describe, expect, it } from "vitest";
import {
  AppendOnlyAuditLog, IdempotencyRegistry, SecretReferenceRegistry, approveHook, assertOptimisticVersion, authorize, authorizeHookExecution,
  createAuditEvent, csrfToken, injectSecret, redactSensitive, signWebhook, verifyCsrf, verifySignedWebhook,
  type Principal
} from "./control";

const owner: Principal = {
  kind: "human", id: "owner-1", authenticated: true,
  grants: [{ workspaceId: "workspace-1", projectIds: ["project-1"], role: "owner" }]
};

describe("authentication, authorization and secrets", () => {
  it("enforces authentication and exact workspace/project scope for mutations, streams and execution", () => {
    for (const action of ["mutate", "stream", "execute"] as const) {
      expect(() => authorize(undefined, { workspaceId: "workspace-1", projectId: "project-1", action })).toThrow("Authentication");
      expect(() => authorize(owner, { workspaceId: "workspace-1", projectId: "project-1", action })).not.toThrow();
      expect(() => authorize(owner, { workspaceId: "workspace-1", projectId: "other", action })).toThrow("not authorized");
    }
  });

  it("implements human roles and explicit agent action scopes", () => {
    const viewer: Principal = { kind: "human", id: "viewer", authenticated: true, grants: [{ workspaceId: "workspace-1", projectIds: "*", role: "viewer" }] };
    expect(() => authorize(viewer, { workspaceId: "workspace-1", projectId: "project-1", action: "stream" })).not.toThrow();
    expect(() => authorize(viewer, { workspaceId: "workspace-1", projectId: "project-1", action: "mutate" })).toThrow("not authorized");
    const agent: Principal = { kind: "agent", id: "agent-1", authenticated: true, workspaceId: "workspace-1", projectId: "project-1", actionScopes: ["read"] };
    expect(() => authorize(agent, { workspaceId: "workspace-1", projectId: "project-1", action: "read" })).not.toThrow();
    expect(() => authorize(agent, { workspaceId: "workspace-1", projectId: "project-1", action: "execute" })).toThrow("not authorized");
  });

  it("requires session-bound CSRF, optimistic versions, idempotency and signed webhooks", () => {
    const token = csrfToken("session-secret");
    expect(() => verifyCsrf("session-secret", token, token)).not.toThrow();
    expect(() => verifyCsrf("other-session", token, token)).toThrow("not bound");
    expect(() => assertOptimisticVersion(2, 3)).toThrow("conflict");
    const registry = new IdempotencyRegistry();
    expect(registry.claim("project-1", "request-1", "payload")).toBe("claimed");
    expect(registry.claim("project-1", "request-1", "payload")).toBe("replayed");
    expect(() => registry.claim("project-1", "request-1", "different")).toThrow("different payload");
    const signature = signWebhook("body", "webhook-secret");
    expect(() => verifySignedWebhook("body", signature, "webhook-secret")).not.toThrow();
    expect(() => verifySignedWebhook("changed", signature, "webhook-secret")).toThrow("Invalid");
  });

  it("injects encrypted references only into approved children and redacts all output surfaces", () => {
    const reference = { id: "secret-1", version: 1, encryptedReference: "enc:v1:ciphertext" as const, allowedChildIds: ["worker-1"], environmentVariable: "PROVIDER_TOKEN" };
    const registry = new SecretReferenceRegistry();
    expect(registry.register(reference)).toEqual(reference);
    expect(registry.register({ ...reference, version: 2, encryptedReference: "enc:v1:rotated" })).toMatchObject({ version: 2 });
    expect(() => registry.register({ ...reference, version: 4 })).toThrow("version must be 3");
    const environment = injectSecret(reference, "worker-1", () => "resolved-value");
    expect(environment).toEqual({ PROVIDER_TOKEN: "resolved-value" });
    expect(() => injectSecret(reference, "web-1", () => "resolved-value")).toThrow("not approved");
    for (const surface of ["log", "error", "trace"]) {
      expect(redactSensitive(`${surface} token=abc resolved-value enc:v1:ciphertext`, ["resolved-value"]))
        .toBe(`${surface} token=[REDACTED] [REDACTED] [ENCRYPTED_REFERENCE]`);
    }
  });

  it("requires hook reapproval on first use, version change or content change", () => {
    const hook = { id: "hook-1", version: 1, content: "npm test" };
    expect(() => authorizeHookExecution(hook, undefined)).toThrow("explicit approval");
    const approval = approveHook(hook, "owner-1", "2026-08-16T20:00:00.000Z");
    expect(() => authorizeHookExecution(hook, approval)).not.toThrow();
    expect(() => authorizeHookExecution({ ...hook, content: "npm test -- --changed" }, approval)).toThrow("explicit approval");
    expect(() => authorizeHookExecution({ ...hook, version: 2 }, approval)).toThrow("explicit approval");
  });

  it("creates sanitized audit events for every privileged action class", () => {
    const actions = ["mutation", "dispatch", "approval", "budget_change", "policy_change", "secret_reference_change"] as const;
    const audit = new AppendOnlyAuditLog();
    for (const [index, action] of actions.entries()) {
      const event = createAuditEvent({
        id: `audit-${index}`, sequence: index + 1, action, actorId: "owner-1", workspaceId: "workspace-1",
        projectId: "project-1", occurredAt: "2026-08-16T20:00:00.000Z", outcome: "allowed",
        details: "authorization=Bearer-private secret-value"
      }, ["secret-value"]);
      expect(event.details).not.toContain("Bearer-private");
      expect(event.details).not.toContain("secret-value");
      expect(Object.isFrozen(event)).toBe(true);
      audit.append(event);
    }
    expect(audit.events()).toHaveLength(actions.length);
    expect(() => audit.append(audit.events()[0])).toThrow("sequence must be 7");
  });
});
