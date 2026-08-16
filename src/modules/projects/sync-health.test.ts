import { describe, expect, it } from "vitest";
import { calculateSyncHealth } from "./sync-health";

describe("project and system synchronization health", () => {
  it("keeps lag, duration and failure semantics explicit", () => {
    const now = new Date("2026-08-14T12:10:00Z");
    const health = calculateSyncHealth([
      { projectId: "a", projectName: "Alpha", sourceId: "a-files", sourceStatus: "available", lastSuccessfulSyncAt: new Date("2026-08-14T12:09:00Z") },
      { projectId: "a", projectName: "Alpha", sourceId: "a-spec", sourceStatus: "stale", lastSuccessfulSyncAt: new Date("2026-08-14T12:08:00Z") },
      { projectId: "b", projectName: "Beta", sourceId: "b-files", sourceStatus: "unavailable", lastSuccessfulSyncAt: null }
    ], [
      { sourceId: "a-files", status: "succeeded", startedAt: new Date("2026-08-14T12:00:00Z"), finishedAt: new Date("2026-08-14T12:00:02Z") },
      { sourceId: "a-spec", status: "partial", startedAt: new Date("2026-08-14T12:01:00Z"), finishedAt: new Date("2026-08-14T12:01:04Z") },
      { sourceId: "b-files", status: "failed", startedAt: new Date("2026-08-14T12:02:00Z"), finishedAt: new Date("2026-08-14T12:02:03Z") }
    ], now);

    expect(health).toMatchObject({ sourceCount: 3, staleSources: 2, failedRuns: 2, maximumLagMs: 120_000, averageDurationMs: 3_000 });
    expect(health.projects[0]).toMatchObject({ projectName: "Alpha", sourceCount: 2, staleSources: 1, failedRuns: 1, syncLagMs: 120_000, averageDurationMs: 3_000 });
    expect(health.projects[1]).toMatchObject({ projectName: "Beta", syncLagMs: null, averageDurationMs: 3_000 });
  });

  it("reports unavailable metrics as null rather than zero", () => {
    expect(calculateSyncHealth([], [], new Date())).toEqual({
      projects: [], sourceCount: 0, staleSources: 0, failedRuns: 0, maximumLagMs: null, averageDurationMs: null
    });
  });
});
