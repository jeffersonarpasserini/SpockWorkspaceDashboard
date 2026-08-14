// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "@/modules/database/connection";
import { projectSources, projects, workspaces } from "@/modules/database/schema";
import { ProjectCatalogRepository } from "./catalog-repository";
import { ShadowProjectCatalogService } from "./shadow-catalog";
import { discoverProjects } from "@/lib/workspace";

const databaseUrl = process.env.SPOCK_TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL project catalog", () => {
  let connection: DatabaseConnection;
  const workspaceSlug = `test-${randomUUID()}`;
  const shadowWorkspaceSlug = `${workspaceSlug}-shadow`;

  beforeAll(() => {
    connection = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl });
  });

  afterAll(async () => {
    for (const slug of [workspaceSlug, shadowWorkspaceSlug]) {
      const workspaceRows = await connection.db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug));
      if (workspaceRows[0]) {
        const projectRows = await connection.db.select({ id: projects.id }).from(projects).where(eq(projects.workspaceId, workspaceRows[0].id));
        for (const project of projectRows) await connection.db.delete(projectSources).where(eq(projectSources.projectId, project.id));
        await connection.db.delete(projects).where(eq(projects.workspaceId, workspaceRows[0].id));
        await connection.db.delete(workspaces).where(eq(workspaces.id, workspaceRows[0].id));
      }
    }
    await connection.close();
  });

  it("persists discovery idempotently and preserves the durable project ID", async () => {
    const repository = new ProjectCatalogRepository(connection.db);
    const identity = { id: "local-alpha", name: "Alpha", markers: [".git", "openspec"] };
    const first = await repository.syncDiscoveredProjects({ name: "Test", slug: workspaceSlug }, [identity], new Date());
    const second = await repository.syncDiscoveredProjects({ name: "Test", slug: workspaceSlug }, [{ ...identity, markers: [".git"] }], new Date());
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0]).toMatchObject({ name: "Alpha", slug: "alpha", sourceStatus: "available" });
  });

  it.runIf(Boolean(process.env.SPOCK_TEST_WORKSPACE_ROOT))("matches the real discovered workspace in shadow mode", async () => {
    const repository = new ProjectCatalogRepository(connection.db);
    const service = new ShadowProjectCatalogService({ discover: discoverProjects }, repository);
    const result = await service.synchronize(
      process.env.SPOCK_TEST_WORKSPACE_ROOT!,
      { name: "Shadow Test", slug: shadowWorkspaceSlug }
    );
    expect(result.discoveredCount).toBeGreaterThan(0);
    expect(result.persistedCount).toBe(result.discoveredCount);
    expect(result).toMatchObject({ matches: true, mismatches: [] });
  });
});
