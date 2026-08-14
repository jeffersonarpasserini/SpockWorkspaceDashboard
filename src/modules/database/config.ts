import { z } from "zod";

const databaseEnvironment = z.object({
  SPOCK_DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
    message: "SPOCK_DATABASE_URL must use PostgreSQL"
  })
});

export interface DatabaseConfig {
  url: string;
}

export function readDatabaseConfig(env: Record<string, string | undefined> = process.env): DatabaseConfig {
  return { url: databaseEnvironment.parse(env).SPOCK_DATABASE_URL };
}
