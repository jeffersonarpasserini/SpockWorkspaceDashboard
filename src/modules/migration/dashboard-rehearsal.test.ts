import { describe, expect, it } from "vitest";
import fixture from "@/test/fixtures/baselines/dashboard-projection.v1.json";
import { rehearseDashboardMigration } from "./dashboard-rehearsal";

describe("current-dashboard migration rehearsal", () => {
  it("imports identity and the exact current observation", () => {
    const result = rehearseDashboardMigration(fixture);
    expect(result.project).toEqual({
      externalId: "U3BvY2tXb3Jrc3BhY2VEYXNoYm9hcmQ",
      name: "SpockWorkspaceDashboard",
      markers: [".git", "openspec"]
    });
    expect(result.observation).toMatchObject({ observedAt: "2026-08-15T00:00:00.000Z", status: "in_progress", gitRevision: "03f47bb", gitDirty: true });
    expect(result.tasks).toEqual([expect.objectContaining({
      externalId: "openspec:establish-project-control-plane:1.3", observedStatus: "todo",
      observedAt: "2026-08-15T00:00:00.000Z"
    })]);
  });

  it("does not invent transitions, runs, usage or evidence from aggregate counters", () => {
    const result = rehearseDashboardMigration(fixture);
    expect(result.historicalTransitions).toEqual([]);
    expect(result.historicalRuns).toEqual([]);
    expect(result.historicalUsage).toEqual([]);
    expect(result.historicalEvidence).toEqual([]);
    expect(result.limitations).toContain("Imported values are one observed snapshot, not lifecycle events.");
    expect(JSON.stringify(result)).not.toContain("acceptedAt");
  });

  it("fails closed for an unknown fixture version", () => {
    expect(() => rehearseDashboardMigration({ ...fixture, fixtureVersion: "dashboard-projection-v2" })).toThrow();
  });
});
