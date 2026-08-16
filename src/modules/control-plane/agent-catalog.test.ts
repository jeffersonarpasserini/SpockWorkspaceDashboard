import { describe, expect, it } from "vitest";
import { APPROVED_AGENT_PROFILES, assertProfileVersion, assertStableRoleBinding, resolveApprovedAgent } from "./agent-catalog";

const roleId = "10000000-0000-4000-8000-000000000001";
const agentId = "10000000-0000-4000-8000-000000000002";
const profileId = "10000000-0000-4000-8000-000000000003";

describe("agent catalog invariants", () => {
  it("keeps a stable role binding independent of mutable profile and model observations", () => {
    const binding = { roleId, agentId, projectId: null, startsAt: new Date("2026-01-01T00:00:00Z"), endsAt: null };
    assertStableRoleBinding(binding);

    for (const profile of [
      { profileVersion: 1, externalProfile: "b-elanna", provider: "provider-a", model: "model-a", configurationHash: "a".repeat(64) },
      { profileVersion: 2, externalProfile: "b-elanna", provider: "provider-b", model: "model-b", configurationHash: "b".repeat(64) }
    ]) {
      expect(() => assertProfileVersion({ id: profileId, agentId, billingMode: "subscription", capabilities: ["typescript"], ...profile })).not.toThrow();
    }

    expect(binding).toMatchObject({ roleId, agentId });
    expect(binding).not.toHaveProperty("profileVersionId");
  });

  it("rejects invalid assignment intervals and mutable-looking profile snapshots", () => {
    expect(() => assertStableRoleBinding({ roleId, agentId, projectId: null, startsAt: new Date("2026-02-01"), endsAt: new Date("2026-01-01") })).toThrow(/end/);
    expect(() => assertProfileVersion({ id: profileId, agentId, profileVersion: 0, externalProfile: "default", provider: "x", model: "x", billingMode: "x", configurationHash: "bad", capabilities: [] })).toThrow(/version/);
  });

  it("preserves the approved 15-agent catalog without secret or prompt material", () => {
    expect(APPROVED_AGENT_PROFILES).toHaveLength(15);
    expect(APPROVED_AGENT_PROFILES.map(({ key }) => key)).toEqual(expect.arrayContaining(["spock", "la-forge", "b-elanna", "barclay", "rutherford", "tuvok", "data", "obrien"]));
    expect(JSON.stringify(APPROVED_AGENT_PROFILES)).not.toMatch(/api[_-]?key|password|private prompt|credential/i);
    expect(APPROVED_AGENT_PROFILES.filter(({ model }) => model === "deepseek-v4-flash-0731").map(({ provider }) => provider)).toEqual(["alibaba-token-plan", "alibaba-token-plan", "alibaba-token-plan"]);
  });

  it("routes specialists only through an explicit project or task policy and never falls back to default", () => {
    const policy = { projectId: "project-1", taskKey: "task-1", agentKey: "b-elanna", allowedCapabilities: ["backend"] };
    expect(resolveApprovedAgent({ projectId: "project-1", taskKey: "task-1", capability: "backend" }, [policy]).key).toBe("b-elanna");
    expect(() => resolveApprovedAgent({ projectId: "project-1", taskKey: "task-2", capability: "backend" }, [policy])).toThrow(/no explicit/);
    expect(() => resolveApprovedAgent({ projectId: "project-1", capability: "routing" }, [{ projectId: "project-1", agentKey: "default", allowedCapabilities: ["routing"] }])).toThrow(/non-default/);
  });
});
