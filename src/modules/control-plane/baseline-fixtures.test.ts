import { describe, expect, it } from "vitest";
import { FakeOrchestratorAdapter } from "../orchestrator/fake";
import { dashboardBaseline, orchestratorBaseline } from "./baseline-fixtures";

describe("versioned control-plane baselines", () => {
  it("records a complete legacy dashboard projection without inventing history", () => {
    expect(dashboardBaseline.projection.tasks).not.toHaveLength(0);
    expect(dashboardBaseline.limitations.join(" ")).toContain("must not be imported as durable history");
    expect(dashboardBaseline.projection.openspec.checked + dashboardBaseline.projection.openspec.unchecked).toBeGreaterThan(0);
  });

  it("keeps orchestrator claims provisional, fixture-only and executable through the fake adapter", async () => {
    const baseline = orchestratorBaseline;
    const adapter = new FakeOrchestratorAdapter(baseline.capabilities);

    expect(baseline.integrationHold).toBe(true);
    expect(baseline.api.liveEndpoint).toBeNull();
    expect(await adapter.capabilities()).toEqual(baseline.capabilities);
    expect(baseline.capabilities.find(({ name }) => name === "feature-team-graph")?.state).toBe("planned");
    expect(baseline.capabilities.find(({ name }) => name === "postgres-checkpointing")?.state).toBe("unavailable");
  });
});
