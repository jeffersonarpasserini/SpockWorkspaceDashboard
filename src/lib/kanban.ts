import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { KANBAN_STATUSES, type BoardTask, type HermesEvidence } from "./types";

const execFileAsync = promisify(execFile);
const rawTaskSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1),
  status: z.enum(KANBAN_STATUSES),
  assignee: z.string().nullish(),
  body: z.string().nullish(),
  priority: z.number().nullish(),
  blocked_reason: z.string().nullish(),
  updated_at: z.string().nullish()
}).passthrough();

export function normalizeHermesTask(input: unknown): BoardTask {
  const task = rawTaskSchema.parse(input);
  return {
    id: `hermes:${task.id}`,
    title: task.title,
    status: task.status,
    source: "hermes",
    assignee: task.assignee ?? undefined,
    body: task.body ?? undefined,
    priority: task.priority ?? undefined,
    blockedReason: task.blocked_reason ?? undefined,
    updatedAt: task.updated_at ?? undefined
  };
}

export function mergeBoardTasks(hermes: BoardTask[], openspec: BoardTask[]): BoardTask[] {
  return [...hermes, ...openspec];
}

function extractTaskArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["tasks", "items", "results"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  throw new Error("Unrecognized Hermes Kanban response");
}

interface HermesCommandOptions {
  timeout: number;
  maxBuffer: number;
  windowsHide: boolean;
}

export type HermesCommandRunner = (
  executable: string,
  args: string[],
  options: HermesCommandOptions
) => Promise<{ stdout: string; stderr?: string }>;

const defaultRunner: HermesCommandRunner = async (executable, args, options) => {
  const result = await execFileAsync(executable, args, { ...options, encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr };
};

export async function readHermesEvidence(
  board: string,
  hermesBin = "hermes",
  runner: HermesCommandRunner = defaultRunner
): Promise<HermesEvidence> {
  try {
    const { stdout } = await runner(hermesBin, ["kanban", "--board", board, "list", "--archived", "--json"], {
      timeout: 8_000,
      maxBuffer: 2_000_000,
      windowsHide: true
    });
    const tasks = extractTaskArray(JSON.parse(stdout)).map(normalizeHermesTask);
    return { availability: "available", board, tasks };
  } catch {
    return { availability: "unavailable", board, tasks: [], message: "Hermes Kanban unavailable" };
  }
}
