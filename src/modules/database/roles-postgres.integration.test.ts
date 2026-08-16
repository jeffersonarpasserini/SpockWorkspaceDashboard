// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "./connection";

const databaseUrl = process.env.SPOCK_TEST_DATABASE_URL;
const webRole = process.env.SPOCK_TEST_WEB_ROLE;
const workerRole = process.env.SPOCK_TEST_WORKER_ROLE;
const migrationRole = process.env.SPOCK_TEST_MIGRATION_ROLE;
const integration = describe.runIf(Boolean(databaseUrl && webRole && workerRole && migrationRole));

integration("PostgreSQL least-privilege roles", () => {
  let connection: DatabaseConnection;
  beforeAll(() => { connection = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl }); });
  afterAll(async () => connection.close());

  it("keeps the web role read-only and away from operational queues", async () => {
    const rows = await connection.client`
      SELECT
        has_schema_privilege(${webRole!}, 'spock', 'USAGE') AS schema_usage,
        has_table_privilege(${webRole!}, 'spock.projects', 'SELECT') AS project_select,
        has_table_privilege(${webRole!}, 'spock.projects', 'INSERT') AS project_insert,
        has_table_privilege(${webRole!}, 'spock.jobs', 'SELECT') AS jobs_select,
        has_table_privilege(${webRole!}, 'spock.domain_events', 'INSERT') AS event_insert
    `;
    expect(rows[0]).toEqual({ schema_usage: true, project_select: true, project_insert: false, jobs_select: false, event_insert: false });
  });

  it("lets the worker claim jobs and append events but not delete or rewrite ledgers", async () => {
    const rows = await connection.client`
      SELECT
        has_table_privilege(${workerRole!}, 'spock.jobs', 'SELECT,INSERT,UPDATE') AS jobs_claim,
        has_table_privilege(${workerRole!}, 'spock.jobs', 'DELETE') AS jobs_delete,
        has_table_privilege(${workerRole!}, 'spock.domain_events', 'INSERT') AS event_insert,
        has_table_privilege(${workerRole!}, 'spock.domain_events', 'UPDATE') AS event_update,
        has_table_privilege(${workerRole!}, 'spock.audit_events', 'DELETE') AS audit_delete
    `;
    expect(rows[0]).toEqual({ jobs_claim: true, jobs_delete: false, event_insert: true, event_update: false, audit_delete: false });
  });

  it("reserves DDL and unrestricted table maintenance for migration", async () => {
    const rows = await connection.client`
      SELECT
        has_schema_privilege(${migrationRole!}, 'spock', 'CREATE') AS schema_create,
        has_table_privilege(${migrationRole!}, 'spock.projects', 'SELECT,INSERT,UPDATE,DELETE') AS project_all,
        has_table_privilege('public', 'spock.projects', 'SELECT') AS public_select
    `;
    expect(rows[0]).toEqual({ schema_create: true, project_all: true, public_select: false });
  });
});
