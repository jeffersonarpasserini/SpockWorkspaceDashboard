import { z } from "zod";

const envSchema = z.object({
  WORKSPACE_ROOT: z.string().min(1).default("/workspace"),
  HERMES_BIN: z.string().min(1).default("hermes"),
  HERMES_BOARD_MAP: z.string().default("{}"),
  HERMES_API_URL: z.string().default(""),
  HERMES_API_KEY: z.string().default("")
});

export interface DashboardConfig {
  workspaceRoot: string;
  hermesBin: string;
  boardMap: Record<string, string>;
  hermesApiUrl: string;
  hermesApiKey: string;
}

export function readDashboardConfig(env: NodeJS.ProcessEnv = process.env): DashboardConfig {
  const parsed = envSchema.parse(env);
  let boardMap: Record<string, string> = {};
  try {
    const candidate = JSON.parse(parsed.HERMES_BOARD_MAP) as unknown;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      boardMap = Object.fromEntries(Object.entries(candidate).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    }
  } catch {
    boardMap = {};
  }
  return {
    workspaceRoot: parsed.WORKSPACE_ROOT,
    hermesBin: parsed.HERMES_BIN,
    boardMap,
    hermesApiUrl: parsed.HERMES_API_URL,
    hermesApiKey: parsed.HERMES_API_KEY
  };
}

export function defaultBoardSlug(projectName: string): string {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
}
