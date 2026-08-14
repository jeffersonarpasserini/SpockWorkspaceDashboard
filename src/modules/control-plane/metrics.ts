export interface TimeInterval {
  startedAt: Date;
  endedAt: Date;
}

export interface TaskMilestones {
  createdAt: Date;
  readyAt?: Date;
  firstRunStartedAt?: Date;
  submittedAt?: Date;
  acceptedAt?: Date;
  projectStartedAt?: Date;
  projectCompletedAt?: Date;
}

export interface DevelopmentMetrics {
  leadTimeMs?: number;
  queueTimeMs?: number;
  cycleTimeMs?: number;
  reviewTimeMs?: number;
  projectElapsedTimeMs?: number;
  activeAgentTimeMs: number;
  agentHours: number;
}

function duration(start?: Date, end?: Date): number | undefined {
  if (!start || !end || end.getTime() < start.getTime()) return undefined;
  return end.getTime() - start.getTime();
}

function validateInterval(interval: TimeInterval): void {
  if (interval.endedAt.getTime() < interval.startedAt.getTime()) {
    throw new Error("Interval end must not precede interval start");
  }
}

export function sumIntervalDurations(intervals: readonly TimeInterval[]): number {
  return intervals.reduce((sum, interval) => {
    validateInterval(interval);
    return sum + interval.endedAt.getTime() - interval.startedAt.getTime();
  }, 0);
}

export function unionIntervalDuration(intervals: readonly TimeInterval[]): number {
  if (intervals.length === 0) return 0;
  const sorted = intervals.map((interval) => {
    validateInterval(interval);
    return { start: interval.startedAt.getTime(), end: interval.endedAt.getTime() };
  }).sort((left, right) => left.start - right.start || left.end - right.end);

  let total = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;
  for (const interval of sorted.slice(1)) {
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      total += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }
  return total + currentEnd - currentStart;
}

export function calculateDevelopmentMetrics(
  milestones: TaskMilestones,
  activeIntervals: readonly TimeInterval[]
): DevelopmentMetrics {
  const activeAgentTimeMs = sumIntervalDurations(activeIntervals);
  return {
    leadTimeMs: duration(milestones.createdAt, milestones.acceptedAt),
    queueTimeMs: duration(milestones.readyAt, milestones.firstRunStartedAt),
    cycleTimeMs: duration(milestones.firstRunStartedAt, milestones.acceptedAt),
    reviewTimeMs: duration(milestones.submittedAt, milestones.acceptedAt),
    projectElapsedTimeMs: duration(milestones.projectStartedAt, milestones.projectCompletedAt),
    activeAgentTimeMs,
    agentHours: activeAgentTimeMs / 3_600_000
  };
}
