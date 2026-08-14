import { describe, expect, it, vi } from "vitest";
import type { ProjectCatalogStore } from "./catalog-repository";
import { compareCatalog, ShadowProjectCatalogService } from "./shadow-catalog";

const discovered = [
  { id: "alpha-local", name: "Alpha", markers: [".git"] },
  { id: "beta-local", name: "Beta Project", markers: ["openspec"] }
];

const persisted = [
  { id: "alpha-db", name: "Alpha", slug: "alpha", sourceStatus: "available", lastSuccessfulSyncAt: new Date() },
  { id: "beta-db", name: "Beta Project", slug: "beta-project", sourceStatus: "available", lastSuccessfulSyncAt: new Date() }
];

describe("shadow project catalog", () => {
  it("reports parity without using local IDs as durable identity", () => {
    expect(compareCatalog(discovered, persisted)).toEqual([]);
  });

  it("reports missing, unexpected and renamed projections deterministically", () => {
    expect(compareCatalog(discovered, [
      { ...persisted[0], name: "ALPHA" },
      { id: "gamma", name: "Gamma", slug: "gamma", sourceStatus: "available", lastSuccessfulSyncAt: null }
    ])).toEqual([
      { kind: "name_mismatch", slug: "alpha", observedName: "Alpha", persistedName: "ALPHA" },
      { kind: "missing_persisted", slug: "beta-project", observedName: "Beta Project" },
      { kind: "unexpected_persisted", slug: "gamma", persistedName: "Gamma" }
    ]);
  });

  it("writes a shadow projection and returns a comparison result", async () => {
    const catalog: ProjectCatalogStore = {
      syncDiscoveredProjects: vi.fn().mockResolvedValue(persisted),
      listWorkspaceProjects: vi.fn().mockResolvedValue(persisted)
    };
    const service = new ShadowProjectCatalogService({ discover: vi.fn().mockResolvedValue(discovered) }, catalog);
    const observedAt = new Date("2026-08-14T20:00:00Z");
    await expect(service.synchronize("/workspace", { name: "Local", slug: "local" }, observedAt)).resolves.toEqual({
      observedAt,
      discoveredCount: 2,
      persistedCount: 2,
      matches: true,
      mismatches: []
    });
  });
});
