import { describe, expect, it } from "vitest";
import { readDashboardConfig } from "./config";

describe("project catalog rollout configuration", () => {
  it("keeps legacy discovery as the safe default", () => {
    expect(readDashboardConfig({})).toMatchObject({ projectCatalogMode: "legacy", workspaceSlug: "local-workspace" });
  });

  it("enables persisted reads only through an explicit valid flag", () => {
    expect(readDashboardConfig({ SPOCK_PROJECT_CATALOG_MODE: "persisted", SPOCK_WORKSPACE_SLUG: "spock-local" }))
      .toMatchObject({ projectCatalogMode: "persisted", workspaceSlug: "spock-local" });
    expect(() => readDashboardConfig({ SPOCK_PROJECT_CATALOG_MODE: "on" })).toThrow();
    expect(() => readDashboardConfig({ SPOCK_WORKSPACE_SLUG: "../escape" })).toThrow();
  });
});
