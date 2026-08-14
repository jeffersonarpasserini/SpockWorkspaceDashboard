// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "@/modules/database/connection";
import {
  documents,
  externalBindings,
  projectSources,
  projects,
  specChanges,
  specRequirements,
  specScenarios,
  specTasks,
  syncRuns,
  workspaces
} from "@/modules/database/schema";
import { OpenSpecRepository } from "./repository";
import { OpenSpecReadRepository } from "./read-model";
import { PostgresOpenSpecSourceRegistration } from "./background-sync";
import { readOpenSpecChangeSnapshot } from "./snapshot";

const databaseUrl = process.env.SPOCK_TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL OpenSpec import", () => {
  let connection: DatabaseConnection;
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const sourceId = randomUUID();

  beforeAll(async () => {
    connection = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl });
    await connection.db.insert(workspaces).values({ id: workspaceId, name: "OpenSpec integration", slug: `openspec-${workspaceId}` });
    await connection.db.insert(projects).values({ id: projectId, workspaceId, name: "Spock", slug: "spock" });
    await connection.db.insert(projectSources).values({ id: sourceId, projectId, kind: "openspec", externalId: "integration" });
  });

  afterAll(async () => {
    const changeRows = await connection.db.select({ id: specChanges.id }).from(specChanges).where(eq(specChanges.sourceId, sourceId));
    for (const change of changeRows) {
      const requirementRows = await connection.db.select({ id: specRequirements.id }).from(specRequirements).where(eq(specRequirements.changeId, change.id));
      for (const requirement of requirementRows) await connection.db.delete(specScenarios).where(eq(specScenarios.requirementId, requirement.id));
      await connection.db.delete(specRequirements).where(eq(specRequirements.changeId, change.id));
      await connection.db.delete(specTasks).where(eq(specTasks.changeId, change.id));
    }
    await connection.db.delete(externalBindings).where(eq(externalBindings.sourceId, sourceId));
    await connection.db.delete(documents).where(eq(documents.sourceId, sourceId));
    await connection.db.delete(syncRuns).where(eq(syncRuns.sourceId, sourceId));
    await connection.db.delete(specChanges).where(eq(specChanges.sourceId, sourceId));
    await connection.db.delete(projectSources).where(eq(projectSources.id, sourceId));
    await connection.db.delete(projects).where(eq(projects.id, projectId));
    await connection.db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await connection.close();
  });

  it("imports the real change transactionally and preserves task IDs on a second revision", async () => {
    const snapshot = await readOpenSpecChangeSnapshot(process.cwd(), "establish-project-control-plane");
    const repository = new OpenSpecRepository(connection.db);
    const first = await repository.importChange(projectId, sourceId, snapshot, new Date("2026-08-14T12:00:00Z"));
    const firstTasks = await connection.db.select().from(specTasks).where(eq(specTasks.changeId, first.changeId));

    expect(first).toMatchObject({
      documents: snapshot.documents.length,
      requirements: snapshot.requirements.length,
      tasks: snapshot.tasks.length,
      executableTasks: true
    });
    expect(first.requirements).toBeGreaterThan(0);
    expect(first.scenarios).toBeGreaterThan(0);

    const changed = {
      ...snapshot,
      sourceRevision: `${snapshot.sourceRevision}-second`,
      tasks: snapshot.tasks.map((task, index) => index === 0 ? { ...task, title: `${task.title} clarified`, checked: !task.checked } : task)
    };
    await repository.importChange(projectId, sourceId, changed, new Date("2026-08-14T12:01:00Z"));
    const secondTasks = await connection.db.select().from(specTasks).where(eq(specTasks.changeId, first.changeId));
    expect(secondTasks).toHaveLength(firstTasks.length);
    expect(secondTasks.find((task) => task.externalRef === firstTasks[0].externalRef)?.id).toBe(firstTasks[0].id);
    expect(await connection.db.select().from(syncRuns).where(eq(syncRuns.sourceId, sourceId))).toHaveLength(2);
    const traceability = await new OpenSpecReadRepository(connection.db).getByExternalProjectId("integration");
    expect(traceability?.changes[0]).toMatchObject({
      key: "establish-project-control-plane",
      sourceRevision: changed.sourceRevision
    });
    expect(traceability?.changes[0].documents.length).toBe(snapshot.documents.length);
    expect(traceability?.changes[0].requirements.length).toBe(snapshot.requirements.length);
    expect(traceability?.changes[0].tasks.length).toBe(snapshot.tasks.length);
  });

  it("persists duplicate observed references as conflicts without creating stable bindings", async () => {
    const base = await readOpenSpecChangeSnapshot(process.cwd(), "establish-project-control-plane");
    const snapshot = {
      ...base,
      changeKey: "duplicate-reference-fixture",
      title: "Duplicate reference fixture",
      sourceRevision: `${base.sourceRevision}-duplicate`,
      requirements: [],
      tasks: [
        { ...base.tasks[0], change: "duplicate-reference-fixture", title: "First", externalRef: "1.1", ordinal: 0 },
        { ...base.tasks[0], change: "duplicate-reference-fixture", title: "Second", externalRef: "1.1", ordinal: 1 }
      ]
    };
    const result = await new OpenSpecRepository(connection.db).importChange(projectId, sourceId, snapshot, new Date("2026-08-14T12:02:00Z"));
    const rows = await connection.db.select().from(specTasks).where(eq(specTasks.changeId, result.changeId));
    expect(result.executableTasks).toBe(false);
    expect(rows).toHaveLength(2);
    expect(rows.every((task) => task.externalRef === null && task.observedRef === "1.1" && task.identityStatus === "conflicted")).toBe(true);
  });

  it("persists bounded background-sync freshness as partial without exposing raw errors", async () => {
    const registration = new PostgresOpenSpecSourceRegistration(connection.db);
    expect(await registration.ensure(projectId, "integration", new Date())).toBe(sourceId);
    await registration.recordPartial(sourceId, new Date("2026-08-14T12:03:00Z"), "Batch limit /private/root", {
      discovered: 25,
      synchronized: 25,
      failed: 0
    });
    const source = await connection.db.select().from(projectSources).where(eq(projectSources.id, sourceId));
    expect(source[0]).toMatchObject({ syncStatus: "stale", sanitizedErrorClass: "Batch_limit__private_root" });
    expect(source[0].sanitizedErrorClass).not.toContain("/");
  });
});
