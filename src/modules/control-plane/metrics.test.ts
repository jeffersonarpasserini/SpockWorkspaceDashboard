import { describe, expect, it } from "vitest";
import { calculateDevelopmentMetrics, sumIntervalDurations, unionIntervalDuration } from "./metrics";

const at = (hour: number) => new Date(`2026-08-14T${String(hour).padStart(2, "0")}:00:00.000Z`);

describe("development metrics", () => {
  it("keeps parallel agent-hours separate from elapsed calendar time", () => {
    const intervals = [
      { startedAt: at(10), endedAt: at(11) },
      { startedAt: at(10), endedAt: at(11) }
    ];
    expect(sumIntervalDurations(intervals)).toBe(2 * 3_600_000);
    expect(unionIntervalDuration(intervals)).toBe(3_600_000);
    expect(calculateDevelopmentMetrics({ createdAt: at(9) }, intervals).agentHours).toBe(2);
  });

  it("does not invent acceptance-dependent metrics", () => {
    expect(calculateDevelopmentMetrics({ createdAt: at(9), firstRunStartedAt: at(10) }, [])).toMatchObject({
      leadTimeMs: undefined,
      cycleTimeMs: undefined,
      reviewTimeMs: undefined
    });
  });

  it("rejects invalid intervals", () => {
    expect(() => sumIntervalDurations([{ startedAt: at(11), endedAt: at(10) }])).toThrow("Interval end");
  });
});
