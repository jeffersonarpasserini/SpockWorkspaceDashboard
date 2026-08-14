import { createDatabaseConnection } from "@/modules/database/connection";
import { OpenSpecReadRepository, type OpenSpecTraceability } from "./read-model";

export async function loadOpenSpecTraceability(externalProjectId: string): Promise<OpenSpecTraceability | null> {
  if (!process.env.SPOCK_DATABASE_URL) return null;
  const connection = createDatabaseConnection();
  try {
    return await new OpenSpecReadRepository(connection.db).getByExternalProjectId(externalProjectId);
  } catch {
    return null;
  } finally {
    await connection.close();
  }
}
