import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

const WORKER_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export interface ClaimedJob {
  id: string;
  kind: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  claimedBy: string;
  claimedUntil: Date;
}

export class JobQueueRepository {
  constructor(private readonly client: Sql) {}

  async enqueue(kind: string, payload: unknown, availableAt = new Date(), maxAttempts = 5): Promise<string> {
    if (!kind.trim() || kind.length > 128) throw new Error("Invalid job kind");
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) throw new Error("Invalid maxAttempts");
    const id = randomUUID();
    await this.client`
      INSERT INTO spock.jobs (id, kind, payload, available_at, max_attempts)
      VALUES (${id}, ${kind}, ${JSON.stringify(payload)}::jsonb, ${availableAt.toISOString()}::timestamptz, ${maxAttempts})
    `;
    return id;
  }

  async claimNext(workerId: string, leaseMs = 30_000): Promise<ClaimedJob | null> {
    if (!WORKER_ID.test(workerId)) throw new Error("Invalid workerId");
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 900_000) throw new Error("Invalid leaseMs");
    const rows = await this.client<ClaimedJob[]>`
      WITH candidate AS (
        SELECT id
        FROM spock.jobs
        WHERE attempts < max_attempts
          AND (
            (status IN ('queued', 'retry_scheduled') AND available_at <= clock_timestamp())
            OR (status = 'claimed' AND claimed_until <= clock_timestamp())
          )
        ORDER BY available_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE spock.jobs AS job
      SET status = 'claimed',
          claimed_by = ${workerId},
          claimed_until = clock_timestamp() + ${leaseMs} * interval '1 millisecond',
          attempts = job.attempts + 1,
          updated_at = clock_timestamp()
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.id,
                job.kind,
                job.payload,
                job.attempts,
                job.max_attempts AS "maxAttempts",
                job.claimed_by AS "claimedBy",
                job.claimed_until AS "claimedUntil"
    `;
    return rows[0] ?? null;
  }
}
