import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  databaseSchema,
  documents,
  externalBindings,
  projectSources,
  specChanges,
  specRequirements,
  specScenarios,
  specTasks,
  syncRuns
} from "@/modules/database/schema";
import { reconcileSpecTasks, taskBindingKey, type PersistedSpecTask } from "./reconciliation";
import type { OpenSpecChangeSnapshot } from "./snapshot";

export interface OpenSpecImportResult {
  changeId: string;
  sourceRevision: string;
  documents: number;
  requirements: number;
  scenarios: number;
  tasks: number;
  executableTasks: boolean;
}

export class OpenSpecRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof databaseSchema>) {}

  async importChange(projectId: string, sourceId: string, snapshot: OpenSpecChangeSnapshot, observedAt: Date): Promise<OpenSpecImportResult> {
    return this.db.transaction(async (tx) => {
      const existingChange = await tx.select({ id: specChanges.id }).from(specChanges).where(and(
        eq(specChanges.sourceId, sourceId),
        eq(specChanges.changeKey, snapshot.changeKey)
      ));
      const changeId = existingChange[0]?.id ?? randomUUID();
      await tx.insert(specChanges).values({
        id: changeId,
        projectId,
        sourceId,
        changeKey: snapshot.changeKey,
        title: snapshot.title,
        sourceRevision: snapshot.sourceRevision
      }).onConflictDoUpdate({
        target: [specChanges.sourceId, specChanges.changeKey],
        set: {
          title: snapshot.title,
          status: "active",
          sourceRevision: snapshot.sourceRevision,
          missingAt: null,
          updatedAt: observedAt,
          version: 1
        }
      });

      const existingDocuments = await tx.select({ id: documents.id, relativePath: documents.relativePath, missingAt: documents.missingAt })
        .from(documents).where(eq(documents.sourceId, sourceId));
      const observedPaths = new Set(snapshot.documents.map((document) => document.relativePath));
      const changePrefix = `openspec/changes/${snapshot.changeKey}/`;
      for (const document of existingDocuments) {
        if (document.relativePath.startsWith(changePrefix) && !observedPaths.has(document.relativePath) && !document.missingAt) {
          await tx.update(documents).set({ missingAt: observedAt, sourceRevision: snapshot.sourceRevision, updatedAt: observedAt })
            .where(eq(documents.id, document.id));
        }
      }

      for (const document of snapshot.documents) {
        await tx.insert(documents).values({
          id: randomUUID(),
          projectId,
          sourceId,
          kind: document.kind,
          title: document.title,
          relativePath: document.relativePath,
          contentHash: document.contentHash,
          sourceRevision: snapshot.sourceRevision,
          lastIndexedAt: observedAt
        }).onConflictDoUpdate({
          target: [documents.sourceId, documents.relativePath],
          set: {
            kind: document.kind,
            title: document.title,
            contentHash: document.contentHash,
            sourceRevision: snapshot.sourceRevision,
            lastIndexedAt: observedAt,
            missingAt: null,
            updatedAt: observedAt,
            version: 1
          }
        });
      }

      const existingRequirements = await tx.select().from(specRequirements).where(eq(specRequirements.changeId, changeId));
      const observedRequirementIds = new Set<string>();
      const observedScenarioIds = new Set<string>();
      let scenarioCount = 0;
      for (const requirement of snapshot.requirements) {
        const previous = existingRequirements.find((item) => item.externalRef === requirement.externalRef);
        const requirementId = previous?.id ?? randomUUID();
        observedRequirementIds.add(requirementId);
        await tx.insert(specRequirements).values({
          id: requirementId,
          changeId,
          capability: requirement.capability,
          externalRef: requirement.externalRef,
          title: requirement.title,
          body: requirement.body,
          ordinal: requirement.ordinal,
          sourceRevision: snapshot.sourceRevision
        }).onConflictDoUpdate({
          target: specRequirements.id,
          set: {
            capability: requirement.capability,
            title: requirement.title,
            body: requirement.body,
            ordinal: requirement.ordinal,
            sourceRevision: snapshot.sourceRevision,
            missingAt: null,
            updatedAt: observedAt,
            version: 1
          }
        });

        const existingScenarios = await tx.select().from(specScenarios).where(eq(specScenarios.requirementId, requirementId));
        for (const scenario of requirement.scenarios) {
          const previousScenario = existingScenarios.find((item) => item.externalRef === scenario.externalRef);
          const scenarioId = previousScenario?.id ?? randomUUID();
          observedScenarioIds.add(scenarioId);
          scenarioCount += 1;
          await tx.insert(specScenarios).values({
            id: scenarioId,
            requirementId,
            externalRef: scenario.externalRef,
            title: scenario.title,
            body: scenario.body,
            ordinal: scenario.ordinal,
            sourceRevision: snapshot.sourceRevision
          }).onConflictDoUpdate({
            target: specScenarios.id,
            set: {
              title: scenario.title,
              body: scenario.body,
              ordinal: scenario.ordinal,
              sourceRevision: snapshot.sourceRevision,
              missingAt: null,
              updatedAt: observedAt,
              version: 1
            }
          });
        }
        for (const scenario of existingScenarios) {
          if (!observedScenarioIds.has(scenario.id) && !scenario.missingAt) {
            await tx.update(specScenarios).set({ missingAt: observedAt, sourceRevision: snapshot.sourceRevision, updatedAt: observedAt })
              .where(eq(specScenarios.id, scenario.id));
          }
        }
      }
      for (const requirement of existingRequirements) {
        if (!observedRequirementIds.has(requirement.id) && !requirement.missingAt) {
          await tx.update(specRequirements).set({ missingAt: observedAt, sourceRevision: snapshot.sourceRevision, updatedAt: observedAt })
            .where(eq(specRequirements.id, requirement.id));
        }
      }

      const previousTaskRows = await tx.select().from(specTasks).where(eq(specTasks.changeId, changeId));
      const previousTasks: PersistedSpecTask[] = previousTaskRows.map((task) => ({
        id: task.id,
        change: snapshot.changeKey,
        section: task.section,
        title: task.title,
        checked: task.checked === 1,
        ordinal: task.ordinal,
        externalRef: task.externalRef ?? undefined,
        bindingKey: taskBindingKey(snapshot.changeKey, task.section, task.title),
        sourceRevision: task.sourceRevision,
        identityStatus: task.identityStatus as PersistedSpecTask["identityStatus"],
        missingAt: task.missingAt
      }));
      const reconciliation = reconcileSpecTasks({
        observed: snapshot.tasks,
        previous: previousTasks,
        bindings: snapshot.bindings,
        sourceRevision: snapshot.sourceRevision,
        observedAt
      });
      for (const entry of reconciliation.entries) {
        const task = entry.task;
        await tx.insert(specTasks).values({
          id: task.id,
          changeId,
          externalRef: task.identityStatus === "stable" ? task.externalRef : null,
          observedRef: task.externalRef,
          section: task.section,
          title: task.title,
          checked: task.checked ? 1 : 0,
          ordinal: task.ordinal,
          sourceRevision: task.sourceRevision,
          identityStatus: task.identityStatus,
          missingAt: task.missingAt
        }).onConflictDoUpdate({
          target: specTasks.id,
          set: {
            externalRef: task.identityStatus === "stable" ? task.externalRef : null,
            observedRef: task.externalRef,
            section: task.section,
            title: task.title,
            checked: task.checked ? 1 : 0,
            ordinal: task.ordinal,
            sourceRevision: task.sourceRevision,
            identityStatus: task.identityStatus,
            missingAt: task.missingAt,
            updatedAt: observedAt,
            version: 1
          }
        });
        if (task.externalRef && task.identityStatus === "stable") {
          await tx.insert(externalBindings).values({
            id: randomUUID(),
            projectId,
            sourceId,
            entityType: "task",
            externalKey: `${snapshot.changeKey}:task:${task.externalRef}`,
            entityId: task.id,
            provenance: "hierarchical_ref",
            sourceRevision: snapshot.sourceRevision
          }).onConflictDoUpdate({
            target: [externalBindings.sourceId, externalBindings.entityType, externalBindings.externalKey],
            set: { entityId: task.id, sourceRevision: snapshot.sourceRevision, updatedAt: observedAt }
          });
        }
      }

      await tx.update(projectSources).set({
        syncStatus: "available",
        sourceRevision: snapshot.sourceRevision,
        lastAttemptedSyncAt: observedAt,
        lastSuccessfulSyncAt: observedAt,
        sanitizedErrorClass: null,
        updatedAt: observedAt
      }).where(eq(projectSources.id, sourceId));
      await tx.insert(syncRuns).values({
        id: randomUUID(),
        sourceId,
        status: "succeeded",
        sourceRevision: snapshot.sourceRevision,
        resultCounts: {
          documents: snapshot.documents.length,
          requirements: snapshot.requirements.length,
          scenarios: scenarioCount,
          tasks: snapshot.tasks.length
        },
        startedAt: observedAt,
        finishedAt: observedAt
      });

      return {
        changeId,
        sourceRevision: snapshot.sourceRevision,
        documents: snapshot.documents.length,
        requirements: snapshot.requirements.length,
        scenarios: scenarioCount,
        tasks: snapshot.tasks.length,
        executableTasks: reconciliation.executable
      };
    });
  }

  async recordReadFailure(sourceId: string, observedAt: Date, errorClass: string): Promise<void> {
    const sanitized = errorClass.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80) || "OpenSpecReadError";
    await this.db.transaction(async (tx) => {
      await tx.update(projectSources).set({
        syncStatus: "stale",
        lastAttemptedSyncAt: observedAt,
        sanitizedErrorClass: sanitized,
        updatedAt: observedAt
      }).where(eq(projectSources.id, sourceId));
      await tx.insert(syncRuns).values({
        id: randomUUID(),
        sourceId,
        status: "failed",
        resultCounts: {},
        sanitizedErrorClass: sanitized,
        startedAt: observedAt,
        finishedAt: observedAt
      });
    });
  }
}
