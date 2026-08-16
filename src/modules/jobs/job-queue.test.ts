// @vitest-environment node
import { describe, expect, it } from "vitest";
import { JobQueueRepository } from "./job-queue";

describe("job queue input boundaries", () => {
  const repository = new JobQueueRepository((() => Promise.resolve([])) as never);

  it("rejects unsafe workers and unbounded leases before querying PostgreSQL", async () => {
    await expect(repository.claimNext("worker with spaces")).rejects.toThrow("Invalid workerId");
    await expect(repository.claimNext("worker-1", 999)).rejects.toThrow("Invalid leaseMs");
    await expect(repository.claimNext("worker-1", 900_001)).rejects.toThrow("Invalid leaseMs");
  });

  it("rejects invalid enqueue limits", async () => {
    await expect(repository.enqueue("", {})).rejects.toThrow("Invalid job kind");
    await expect(repository.enqueue("sync", {}, new Date(), 0)).rejects.toThrow("Invalid maxAttempts");
  });
});
