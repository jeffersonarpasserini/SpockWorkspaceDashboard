import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.SPOCK_DATABASE_URL;
if (!databaseUrl || (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://"))) {
  throw new Error("SPOCK_DATABASE_URL must be a PostgreSQL URL");
}

const migrationDirectory = path.join(process.cwd(), "database", "migrations");
const names = (await readdir(migrationDirectory)).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });
const connection = await sql.reserve();
const lockKey = 7_314_920_024;
let locked = false;

try {
  await connection`SELECT pg_advisory_lock(${lockKey})`;
  locked = true;
  const table = await connection`SELECT to_regclass('spock.schema_migrations') AS name`;
  const applied = new Set(table[0]?.name ? (await connection`SELECT version FROM spock.schema_migrations`).map((row) => row.version) : []);
  for (const name of names) {
    const version = name.slice(0, 4) + "_" + name.slice(5, -4);
    if (applied.has(version)) continue;
    const migration = await readFile(path.join(migrationDirectory, name), "utf8");
    await connection.unsafe(migration);
    process.stdout.write(`applied ${version}\n`);
  }
} catch (error) {
  try { await connection.unsafe("ROLLBACK"); } catch {}
  throw error;
} finally {
  if (locked) {
    try { await connection`SELECT pg_advisory_unlock(${lockKey})`; } catch {}
  }
  connection.release();
  await sql.end({ timeout: 5 });
}
