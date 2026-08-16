// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "./connection";
import { checkSchemaReadiness } from "./readiness";

const databaseUrl = process.env.SPOCK_TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL readiness and append-only retention", () => {
  let connection: DatabaseConnection;
  beforeAll(() => { connection = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl }); });
  afterAll(async () => connection.close());

  it("reports the required schema while accepting compatible later migrations", async () => {
    await expect(checkSchemaReadiness(connection.client)).resolves.toMatchObject({
      ready: true,
      requiredVersion: "0007_runtime_retention_governance",
      missing: []
    });
  });

  it("rejects updates to domain events and rolls the fixture back", async () => {
    await expect(connection.client.begin(async (tx) => {
      const workspaceId = randomUUID();
      const eventId = randomUUID();
      await tx`INSERT INTO spock.workspaces (id, name, slug) VALUES (${workspaceId}, 'Retention test', ${`retention-${workspaceId}`})`;
      await tx`
        INSERT INTO spock.domain_events
          (event_id, workspace_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, payload, occurred_at)
        VALUES (${eventId}, ${workspaceId}, 'test', ${randomUUID()}, 'created', 'system', 'test', '{}'::jsonb, clock_timestamp())
      `;
      await tx`UPDATE spock.domain_events SET event_type = 'tampered' WHERE event_id = ${eventId}`;
    })).rejects.toMatchObject({ code: "55000" });
  });

  it("rejects audit deletion before retention expiry and rolls the fixture back", async () => {
    await expect(connection.client.begin(async (tx) => {
      const workspaceId = randomUUID();
      const eventId = randomUUID();
      await tx`INSERT INTO spock.workspaces (id, name, slug) VALUES (${workspaceId}, 'Audit retention test', ${`audit-retention-${workspaceId}`})`;
      await tx`
        INSERT INTO spock.audit_events
          (event_id, workspace_id, actor_type, actor_id, action, target_type, target_id, payload, occurred_at)
        VALUES (${eventId}, ${workspaceId}, 'system', 'test', 'created', 'test', 'fixture', '{}'::jsonb, clock_timestamp())
      `;
      await tx`DELETE FROM spock.audit_events WHERE event_id = ${eventId}`;
    })).rejects.toMatchObject({ code: "55000" });
  });
});
