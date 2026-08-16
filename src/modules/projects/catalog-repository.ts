import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ProjectIdentity } from "@/lib/types";
import { databaseSchema, projectSources, projects, workspaces } from "@/modules/database/schema";

export interface WorkspaceRegistration {
  name: string;
  slug: string;
}

export interface PersistedProject {
  id: string;
  externalId: string;
  name: string;
  slug: string;
  markers: readonly string[];
  sourceStatus: string;
  lastSuccessfulSyncAt: Date | null;
}

export interface ProjectCatalogStore {
  syncDiscoveredProjects(
    workspace: WorkspaceRegistration,
    discovered: readonly ProjectIdentity[],
    observedAt: Date
  ): Promise<readonly PersistedProject[]>;
  listWorkspaceProjects(workspaceSlug: string): Promise<readonly PersistedProject[]>;
}

export class ProjectCatalogRepository implements ProjectCatalogStore {
  constructor(private readonly db: PostgresJsDatabase<typeof databaseSchema>) {}

  async syncDiscoveredProjects(
    workspace: WorkspaceRegistration,
    discovered: readonly ProjectIdentity[],
    observedAt: Date
  ): Promise<readonly PersistedProject[]> {
    return this.db.transaction(async (tx) => {
      const workspaceRows = await tx.insert(workspaces).values({
        id: randomUUID(),
        name: workspace.name,
        slug: workspace.slug
      }).onConflictDoUpdate({
        target: workspaces.slug,
        set: { name: workspace.name, version: 1 }
      }).returning({ id: workspaces.id });
      const workspaceId = workspaceRows[0].id;

      for (const identity of discovered) {
        const slug = projectSlug(identity.name);
        const projectRows = await tx.insert(projects).values({
          id: randomUUID(),
          workspaceId,
          name: identity.name,
          slug
        }).onConflictDoUpdate({
          target: [projects.workspaceId, projects.slug],
          set: {
            name: identity.name,
            updatedAt: observedAt,
            version: 1
          }
        }).returning({ id: projects.id });

        const projectId = projectRows[0].id;
        const existingSources = await tx.select({ id: projectSources.id })
          .from(projectSources)
          .where(and(
            eq(projectSources.projectId, projectId),
            eq(projectSources.kind, "filesystem")
          ));
        const sourceValues = {
          projectId,
          kind: "filesystem",
          externalId: identity.id,
          configuration: { markers: identity.markers },
          syncStatus: "available",
          lastAttemptedSyncAt: observedAt,
          lastSuccessfulSyncAt: observedAt,
          updatedAt: observedAt,
          version: 1
        } as const;
        if (existingSources[0]) {
          await tx.update(projectSources).set(sourceValues).where(eq(projectSources.id, existingSources[0].id));
        } else {
          await tx.insert(projectSources).values({ id: randomUUID(), ...sourceValues });
        }
      }

      return this.listProjects(workspaceId, tx);
    });
  }

  async listWorkspaceProjects(workspaceSlug: string): Promise<readonly PersistedProject[]> {
    const rows = await this.db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, workspaceSlug));
    return rows[0] ? this.listProjects(rows[0].id, this.db) : [];
  }

  private async listProjects(
    workspaceId: string,
    executor: Pick<PostgresJsDatabase<typeof databaseSchema>, "select">
  ): Promise<readonly PersistedProject[]> {
    return executor.select({
      id: projects.id,
      externalId: projectSources.externalId,
      name: projects.name,
      slug: projects.slug,
      configuration: projectSources.configuration,
      sourceStatus: projectSources.syncStatus,
      lastSuccessfulSyncAt: projectSources.lastSuccessfulSyncAt
    }).from(projects)
      .innerJoin(projectSources, and(
        eq(projectSources.projectId, projects.id),
        eq(projectSources.kind, "filesystem")
      ))
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.name)).then((rows) => rows.flatMap((row) => {
        if (!row.externalId) return [];
        const configuration = row.configuration && typeof row.configuration === "object" && !Array.isArray(row.configuration)
          ? row.configuration as Record<string, unknown>
          : {};
        const markers = Array.isArray(configuration.markers)
          ? configuration.markers.filter((marker): marker is string => typeof marker === "string")
          : [];
        return [{
          id: row.id,
          externalId: row.externalId,
          name: row.name,
          slug: row.slug,
          markers,
          sourceStatus: row.sourceStatus,
          lastSuccessfulSyncAt: row.lastSuccessfulSyncAt
        }];
      }));
  }
}

export function projectSlug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}
