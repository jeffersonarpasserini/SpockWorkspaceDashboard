import { describe, expect, it, vi } from "vitest";
import { createPersistedProjectDiscovery } from "./persisted-discovery";

describe("persisted project discovery feature flag target", () => {
  it("projects durable catalog rows back to containment-safe external route IDs", async () => {
    const listWorkspaceProjects = vi.fn().mockResolvedValue([{
      id: "durable-id",
      externalId: "U3BvY2s",
      name: "Spock",
      slug: "spock",
      markers: [".git", "openspec"],
      sourceStatus: "available",
      lastSuccessfulSyncAt: new Date()
    }]);
    const discover = createPersistedProjectDiscovery({ listWorkspaceProjects }, "local");
    await expect(discover("/workspace")).resolves.toEqual([{ id: "U3BvY2s", name: "Spock", markers: [".git", "openspec"] }]);
    expect(listWorkspaceProjects).toHaveBeenCalledWith("local");
  });
});
