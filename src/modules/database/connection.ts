import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { readDatabaseConfig } from "./config";
import { databaseSchema } from "./schema";

export interface DatabaseConnection {
  client: Sql;
  db: PostgresJsDatabase<typeof databaseSchema>;
  close(): Promise<void>;
}

export function createDatabaseConnection(env: Record<string, string | undefined> = process.env): DatabaseConnection {
  const config = readDatabaseConfig(env);
  const client = postgres(config.url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });
  return {
    client,
    db: drizzle(client, { schema: databaseSchema }),
    close: () => client.end({ timeout: 5 })
  };
}
