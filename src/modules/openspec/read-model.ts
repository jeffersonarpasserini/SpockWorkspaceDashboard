import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  databaseSchema,
  documents,
  projectSources,
  specChanges,
  specRequirements,
  specScenarios,
  specTasks
} from "@/modules/database/schema";

export interface OpenSpecTraceabilityScenario {
  id: string;
  ref: string | null;
  title: string;
  body: string;
  sourceRevision: string;
  missing: boolean;
}

export interface OpenSpecTraceabilityRequirement {
  id: string;
  ref: string | null;
  capability: string;
  title: string;
  body: string;
  sourceRevision: string;
  missing: boolean;
  scenarios: readonly OpenSpecTraceabilityScenario[];
}

export interface OpenSpecTraceabilityTask {
  id: string;
  ref: string | null;
  observedRef: string | null;
  section: string;
  title: string;
  checked: boolean;
  identityStatus: string;
  sourceRevision: string;
  missing: boolean;
}

export interface OpenSpecTraceabilityDocument {
  id: string;
  kind: string;
  title: string;
  relativePath: string;
  contentHash: string;
  sourceRevision: string | null;
  missing: boolean;
}

export interface OpenSpecTraceabilityChange {
  id: string;
  key: string;
  title: string;
  status: string;
  sourceRevision: string;
  requirements: readonly OpenSpecTraceabilityRequirement[];
  tasks: readonly OpenSpecTraceabilityTask[];
  documents: readonly OpenSpecTraceabilityDocument[];
}

export interface OpenSpecTraceability {
  projectId: string;
  changes: readonly OpenSpecTraceabilityChange[];
}

export class OpenSpecReadRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof databaseSchema>) {}

  async getByExternalProjectId(externalProjectId: string): Promise<OpenSpecTraceability | null> {
    const sourceRows = await this.db.select({ projectId: projectSources.projectId })
      .from(projectSources)
      .where(eq(projectSources.externalId, externalProjectId))
      .limit(1);
    if (!sourceRows[0]) return null;
    const projectId = sourceRows[0].projectId;
    const changeRows = await this.db.select().from(specChanges)
      .where(eq(specChanges.projectId, projectId))
      .orderBy(asc(specChanges.changeKey));
    const allDocuments = await this.db.select().from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(asc(documents.relativePath));

    const changes: OpenSpecTraceabilityChange[] = [];
    for (const change of changeRows) {
      const requirementRows = await this.db.select().from(specRequirements)
        .where(eq(specRequirements.changeId, change.id))
        .orderBy(asc(specRequirements.ordinal));
      const requirements: OpenSpecTraceabilityRequirement[] = [];
      for (const requirement of requirementRows) {
        const scenarioRows = await this.db.select().from(specScenarios)
          .where(eq(specScenarios.requirementId, requirement.id))
          .orderBy(asc(specScenarios.ordinal));
        requirements.push({
          id: requirement.id,
          ref: requirement.externalRef,
          capability: requirement.capability,
          title: requirement.title,
          body: requirement.body,
          sourceRevision: requirement.sourceRevision,
          missing: requirement.missingAt !== null,
          scenarios: scenarioRows.map((scenario) => ({
            id: scenario.id,
            ref: scenario.externalRef,
            title: scenario.title,
            body: scenario.body,
            sourceRevision: scenario.sourceRevision,
            missing: scenario.missingAt !== null
          }))
        });
      }
      const taskRows = await this.db.select().from(specTasks)
        .where(eq(specTasks.changeId, change.id))
        .orderBy(asc(specTasks.ordinal));
      const prefix = `openspec/changes/${change.changeKey}/`;
      changes.push({
        id: change.id,
        key: change.changeKey,
        title: change.title,
        status: change.status,
        sourceRevision: change.sourceRevision,
        requirements,
        tasks: taskRows.map((task) => ({
          id: task.id,
          ref: task.externalRef,
          observedRef: task.observedRef,
          section: task.section,
          title: task.title,
          checked: task.checked === 1,
          identityStatus: task.identityStatus,
          sourceRevision: task.sourceRevision,
          missing: task.missingAt !== null
        })),
        documents: allDocuments.filter((document) => document.relativePath.startsWith(prefix)).map((document) => ({
          id: document.id,
          kind: document.kind,
          title: document.title,
          relativePath: document.relativePath,
          contentHash: document.contentHash,
          sourceRevision: document.sourceRevision,
          missing: document.missingAt !== null
        }))
      });
    }
    return { projectId, changes };
  }
}
