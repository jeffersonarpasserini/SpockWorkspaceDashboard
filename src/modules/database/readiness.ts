import type { Sql } from "postgres";

export const REQUIRED_SCHEMA_MIGRATIONS = [
  "0001_control_plane_foundation",
  "0002_openspec_governance",
  "0003_openspec_observed_references",
  "0004_event_retention_and_job_claims",
  "0005_fix_retention_trigger_record_timestamp",
  "0006_agent_catalog",
  "0007_runtime_retention_governance"
] as const;

export interface SchemaReadiness {
  ready: boolean;
  currentVersion: string | null;
  requiredVersion: string;
  missing: readonly string[];
}

export function evaluateSchemaReadiness(installed: readonly string[]): SchemaReadiness {
  const installedSet = new Set(installed);
  const missing = REQUIRED_SCHEMA_MIGRATIONS.filter((version) => !installedSet.has(version));
  return {
    ready: missing.length === 0,
    currentVersion: installed.length > 0 ? [...installed].sort().at(-1) ?? null : null,
    requiredVersion: REQUIRED_SCHEMA_MIGRATIONS.at(-1)!,
    missing
  };
}

export async function checkSchemaReadiness(client: Sql): Promise<SchemaReadiness> {
  const table = await client`SELECT to_regclass('spock.schema_migrations') AS name`;
  if (!table[0]?.name) return evaluateSchemaReadiness([]);
  const rows = await client`SELECT version FROM spock.schema_migrations ORDER BY version`;
  return evaluateSchemaReadiness(rows.map((row) => String(row.version)));
}

export async function assertSchemaReady(client: Sql): Promise<void> {
  const readiness = await checkSchemaReadiness(client);
  if (!readiness.ready) throw new Error(`Spock schema is not ready; missing: ${readiness.missing.join(", ")}`);
}
