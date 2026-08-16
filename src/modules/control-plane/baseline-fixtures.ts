import { z } from "zod";
import dashboardFixture from "@/test/fixtures/baselines/dashboard-projection.v1.json";
import orchestratorFixture from "@/test/fixtures/baselines/orchestrator-contract.v1.json";

const availability = z.enum(["available", "unavailable", "not_configured"]);
const taskStatus = z.enum(["triage", "todo", "ready", "running", "blocked", "done", "archived"]);
const capabilityState = z.enum(["implemented", "validated_shadow", "planned", "unavailable"]);

export const dashboardBaselineSchema = z.object({
  fixtureVersion: z.literal("dashboard-projection-v1"),
  capturedAt: z.iso.datetime(),
  projection: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    markers: z.array(z.string()),
    git: z.object({
      availability,
      branch: z.string().optional(),
      dirty: z.boolean().optional(),
      commit: z.string().optional(),
      message: z.string().optional()
    }),
    openspec: z.object({
      availability,
      checked: z.number().int().nonnegative(),
      unchecked: z.number().int().nonnegative(),
      changes: z.number().int().nonnegative(),
      message: z.string().optional()
    }),
    hermes: z.object({
      availability,
      board: z.string(),
      running: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
      message: z.string().optional()
    }),
    status: z.enum(["blocked", "in_progress", "complete_locally", "unknown"]),
    observedAt: z.iso.datetime(),
    tasks: z.array(z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      status: taskStatus,
      source: z.enum(["hermes", "openspec"]),
      assignee: z.string().optional(),
      body: z.string().optional(),
      change: z.string().optional(),
      section: z.string().optional(),
      priority: z.number().optional(),
      blockedReason: z.string().optional(),
      updatedAt: z.string().optional()
    })),
  }),
  limitations: z.array(z.string()).min(1)
});

export const orchestratorBaselineSchema = z.object({
  fixtureVersion: z.literal("orchestrator-contract-v1"),
  capturedAt: z.iso.datetime(),
  provisional: z.literal(true),
  integrationHold: z.literal(true),
  api: z.object({
    contractVersion: z.string().min(1),
    transport: z.literal("fixture-only"),
    liveEndpoint: z.null(),
    operations: z.array(z.enum(["capabilities", "submit"]))
  }),
  schema: z.object({
    runtime: z.string().min(1),
    persistence: z.string().min(1),
    generalRunEventModel: z.boolean(),
    postgresCheckpointer: z.boolean()
  }),
  capabilities: z.array(z.object({
    name: z.string().min(1),
    state: capabilityState,
    contractVersion: z.string().min(1)
  })),
  pilotObservation: z.object({
    taskCount: z.number().int().nonnegative(),
    firstAttemptSuccessRate: z.number().min(0).max(1),
    simulatedAndBilledCostsSeparated: z.boolean()
  })
});

export const dashboardBaseline = dashboardBaselineSchema.parse(dashboardFixture);
export const orchestratorBaseline = orchestratorBaselineSchema.parse(orchestratorFixture);
