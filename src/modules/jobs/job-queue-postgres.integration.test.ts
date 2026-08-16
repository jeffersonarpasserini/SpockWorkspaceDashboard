// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "@/modules/database/connection";
import { JobQueueRepository } from "./job-queue";

const databaseUrl = process.env.SPOCK_TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(databaseUrl));

integration("PostgreSQL atomic job claims", () => {
  let first: DatabaseConnection;
  let second: DatabaseConnection;
  const created: string[] = [];

  beforeAll(() => {
    first = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl });
    second = createDatabaseConnection({ SPOCK_DATABASE_URL: databaseUrl });
  });

  afterAll(async () => {
    if (created.length > 0) await first.client`DELETE FROM spock.jobs WHERE id = ANY(${created})`;
    await Promise.all([first.close(), second.close()]);
  });

  it("allows only one of two concurrent workers to claim a single ready job", async () => {
    const firstQueue = new JobQueueRepository(first.client);
    const secondQueue = new JobQueueRepository(second.client);
    const id = await firstQueue.enqueue("openspec.sync", { projectId: "project" });
    created.push(id);
    const claims = await Promise.all([
      firstQueue.claimNext("worker-a", 30_000),
      secondQueue.claimNext("worker-b", 30_000)
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)).toMatchObject({ id, attempts: 1 });
  });

  it("recovers an expired lease exactly once and increments the attempt", async () => {
    const queue = new JobQueueRepository(first.client);
    const id = await queue.enqueue("openspec.sync", { projectId: "recover" });
    created.push(id);
    const initial = await queue.claimNext("worker-crashed", 1_000);
    expect(initial).toMatchObject({ id, attempts: 1 });
    await first.client`UPDATE spock.jobs SET claimed_until = clock_timestamp() - interval '1 second' WHERE id = ${id}`;
    const claims = await Promise.all([
      queue.claimNext("worker-recovery-a", 30_000),
      new JobQueueRepository(second.client).claimNext("worker-recovery-b", 30_000)
    ]);
    expect(claims.filter((claim) => claim?.id === id)).toHaveLength(1);
    expect(claims.find((claim) => claim?.id === id)).toMatchObject({ attempts: 2 });
  });
});
