import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { databaseSchema, projectSources, syncRuns } from "@/modules/database/schema";
import { listActiveOpenSpecChanges, type ActiveChangeCatalog } from "./change-catalog";
import type { OpenSpecSyncService } from "./sync-service";
import { OPEN_SPEC_MUTATION_POLICY } from "./mutation-policy";

export interface OpenSpecSourceRegistration {
  ensure(projectId: string, externalProjectId: string, observedAt: Date): Promise<string>;
  recordPartial(sourceId: string, observedAt: Date, reason: string, counts: Record<string, number>): Promise<void>;
}

export class PostgresOpenSpecSourceRegistration implements OpenSpecSourceRegistration {
  constructor(private readonly db: PostgresJsDatabase<typeof databaseSchema>) {}

  async ensure(projectId: string, externalProjectId: string, observedAt: Date): Promise<string> {
    const rows = await this.db.select({ id: projectSources.id }).from(projectSources).where(and(
      eq(projectSources.projectId, projectId),
      eq(projectSources.kind, "openspec")
    ));
    if (rows[0]) return rows[0].id;
    const id = randomUUID();
    await this.db.insert(projectSources).values({
      id,
      projectId,
      kind: "openspec",
      externalId: externalProjectId,
      syncStatus: "pending",
      lastAttemptedSyncAt: observedAt,
      configuration: { mode: OPEN_SPEC_MUTATION_POLICY.mode, mutations: OPEN_SPEC_MUTATION_POLICY.enabled }
    });
    return id;
  }

  async recordPartial(sourceId: string, observedAt: Date, reason: string, counts: Record<string, number>): Promise<void> {
    const sanitized = reason.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80) || "OpenSpecPartialSync";
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
        status: "partial",
        resultCounts: counts,
        sanitizedErrorClass: sanitized,
        startedAt: observedAt,
        finishedAt: observedAt
      });
    });
  }
}

export interface OpenSpecBackgroundSyncResult {
  sourceId: string;
  discovered: number;
  synchronized: number;
  failed: number;
  truncated: boolean;
  deadlineReached: boolean;
}

export class OpenSpecBackgroundSync {
  constructor(
    private readonly sourceRegistration: OpenSpecSourceRegistration,
    private readonly syncService: Pick<OpenSpecSyncService, "synchronize">,
    private readonly catalog: (projectPath: string, limit: number) => Promise<ActiveChangeCatalog> = listActiveOpenSpecChanges,
    private readonly clock: () => number = Date.now
  ) {}

  async run(input: {
    projectId: string;
    externalProjectId: string;
    projectPath: string;
    maxChanges?: number;
    timeBudgetMs?: number;
    observedAt?: Date;
  }): Promise<OpenSpecBackgroundSyncResult> {
    const maxChanges = boundedInteger(input.maxChanges ?? 25, 1, 250, "maxChanges");
    const timeBudgetMs = boundedInteger(input.timeBudgetMs ?? 30_000, 100, 300_000, "timeBudgetMs");
    const observedAt = input.observedAt ?? new Date();
    const deadline = this.clock() + timeBudgetMs;
    const sourceId = await this.sourceRegistration.ensure(input.projectId, input.externalProjectId, observedAt);
    const catalog = await this.catalog(input.projectPath, maxChanges);
    let synchronized = 0;
    let failed = 0;
    let deadlineReached = false;

    for (const changeKey of catalog.keys) {
      if (this.clock() >= deadline) {
        deadlineReached = true;
        break;
      }
      try {
        await this.syncService.synchronize({ projectId: input.projectId, sourceId, projectPath: input.projectPath, changeKey, observedAt });
        synchronized += 1;
      } catch {
        failed += 1;
      }
    }

    if (catalog.truncated || deadlineReached || failed > 0) {
      await this.sourceRegistration.recordPartial(
        sourceId,
        observedAt,
        catalog.truncated ? "OpenSpecBatchLimit" : deadlineReached ? "OpenSpecTimeBudget" : "OpenSpecChangeFailure",
        { discovered: catalog.keys.length, synchronized, failed }
      );
    }
    return { sourceId, discovered: catalog.keys.length, synchronized, failed, truncated: catalog.truncated, deadlineReached };
  }
}

function boundedInteger(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${name}`);
  return value;
}
