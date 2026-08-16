import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { databaseSchema, projectSources, projects, syncRuns } from "@/modules/database/schema";

export interface SyncHealthSource {
  projectId: string;
  projectName: string;
  sourceId: string;
  sourceStatus: string;
  lastSuccessfulSyncAt: Date | null;
}

export interface SyncHealthRun {
  sourceId: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface ProjectSyncHealth {
  projectId: string;
  projectName: string;
  sourceCount: number;
  staleSources: number;
  failedRuns: number;
  syncLagMs: number | null;
  averageDurationMs: number | null;
}

export interface SystemSyncHealth {
  projects: readonly ProjectSyncHealth[];
  sourceCount: number;
  staleSources: number;
  failedRuns: number;
  maximumLagMs: number | null;
  averageDurationMs: number | null;
}

export function calculateSyncHealth(sources: readonly SyncHealthSource[], runs: readonly SyncHealthRun[], now: Date): SystemSyncHealth {
  const runsBySource = new Map<string, SyncHealthRun[]>();
  for (const run of runs) runsBySource.set(run.sourceId, [...(runsBySource.get(run.sourceId) ?? []), run]);
  const grouped = new Map<string, SyncHealthSource[]>();
  for (const source of sources) grouped.set(source.projectId, [...(grouped.get(source.projectId) ?? []), source]);

  const projects = [...grouped.entries()].map(([projectId, projectSources]) => {
    const projectRuns = projectSources.flatMap((source) => runsBySource.get(source.sourceId) ?? []);
    const durations = completedDurations(projectRuns);
    const lags = projectSources.flatMap((source) => source.lastSuccessfulSyncAt ? [Math.max(0, now.getTime() - source.lastSuccessfulSyncAt.getTime())] : []);
    return {
      projectId,
      projectName: projectSources[0].projectName,
      sourceCount: projectSources.length,
      staleSources: projectSources.filter((source) => source.sourceStatus === "stale" || source.sourceStatus === "unavailable").length,
      failedRuns: projectRuns.filter((run) => run.status === "failed" || run.status === "partial").length,
      syncLagMs: lags.length > 0 ? Math.max(...lags) : null,
      averageDurationMs: average(durations)
    };
  }).sort((left, right) => left.projectName.localeCompare(right.projectName));
  const allDurations = completedDurations(runs);
  const lags = projects.flatMap((project) => project.syncLagMs === null ? [] : [project.syncLagMs]);
  return {
    projects,
    sourceCount: sources.length,
    staleSources: projects.reduce((total, project) => total + project.staleSources, 0),
    failedRuns: projects.reduce((total, project) => total + project.failedRuns, 0),
    maximumLagMs: lags.length > 0 ? Math.max(...lags) : null,
    averageDurationMs: average(allDurations)
  };
}

export class ProjectSyncHealthRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof databaseSchema>) {}

  async load(now = new Date()): Promise<SystemSyncHealth> {
    const sources = await this.db.select({
      projectId: projects.id,
      projectName: projects.name,
      sourceId: projectSources.id,
      sourceStatus: projectSources.syncStatus,
      lastSuccessfulSyncAt: projectSources.lastSuccessfulSyncAt
    }).from(projectSources).innerJoin(projects, eq(projects.id, projectSources.projectId)).orderBy(asc(projects.name));
    const runs = await this.db.select({
      sourceId: syncRuns.sourceId,
      status: syncRuns.status,
      startedAt: syncRuns.startedAt,
      finishedAt: syncRuns.finishedAt
    }).from(syncRuns);
    return calculateSyncHealth(sources, runs, now);
  }
}

function completedDurations(runs: readonly SyncHealthRun[]): number[] {
  return runs.flatMap((run) => run.finishedAt ? [Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime())] : []);
}

function average(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;
}
