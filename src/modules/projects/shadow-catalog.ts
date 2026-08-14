import type { ProjectIdentity } from "@/lib/types";
import type { PersistedProject, ProjectCatalogStore, WorkspaceRegistration } from "./catalog-repository";
import { projectSlug } from "./catalog-repository";

export interface CatalogMismatch {
  kind: "missing_persisted" | "unexpected_persisted" | "name_mismatch";
  slug: string;
  observedName?: string;
  persistedName?: string;
}

export interface ShadowSyncResult {
  observedAt: Date;
  discoveredCount: number;
  persistedCount: number;
  matches: boolean;
  mismatches: readonly CatalogMismatch[];
}

export interface ProjectDiscovery {
  discover(root: string): Promise<readonly ProjectIdentity[]>;
}

export class ShadowProjectCatalogService {
  constructor(
    private readonly discovery: ProjectDiscovery,
    private readonly catalog: ProjectCatalogStore
  ) {}

  async synchronize(
    workspaceRoot: string,
    workspace: WorkspaceRegistration,
    observedAt = new Date()
  ): Promise<ShadowSyncResult> {
    const discovered = await this.discovery.discover(workspaceRoot);
    const persisted = await this.catalog.syncDiscoveredProjects(workspace, discovered, observedAt);
    const mismatches = compareCatalog(discovered, persisted);
    return {
      observedAt,
      discoveredCount: discovered.length,
      persistedCount: persisted.length,
      matches: mismatches.length === 0,
      mismatches
    };
  }
}

export function compareCatalog(
  discovered: readonly ProjectIdentity[],
  persisted: readonly PersistedProject[]
): readonly CatalogMismatch[] {
  const observedBySlug = new Map(discovered.map((project) => [projectSlug(project.name), project]));
  const persistedBySlug = new Map(persisted.map((project) => [project.slug, project]));
  const mismatches: CatalogMismatch[] = [];

  for (const [slug, observed] of observedBySlug) {
    const stored = persistedBySlug.get(slug);
    if (!stored) {
      mismatches.push({ kind: "missing_persisted", slug, observedName: observed.name });
    } else if (stored.name !== observed.name) {
      mismatches.push({ kind: "name_mismatch", slug, observedName: observed.name, persistedName: stored.name });
    }
  }
  for (const [slug, stored] of persistedBySlug) {
    if (!observedBySlug.has(slug)) {
      mismatches.push({ kind: "unexpected_persisted", slug, persistedName: stored.name });
    }
  }
  return mismatches.sort((left, right) => left.slug.localeCompare(right.slug) || left.kind.localeCompare(right.kind));
}
