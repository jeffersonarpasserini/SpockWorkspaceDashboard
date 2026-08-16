import { describe, expect, it } from "vitest";
import { evaluateSchemaReadiness, REQUIRED_SCHEMA_MIGRATIONS } from "./readiness";

describe("database schema readiness", () => {
  it("requires every forward migration rather than only table existence", () => {
    expect(evaluateSchemaReadiness(REQUIRED_SCHEMA_MIGRATIONS)).toEqual({
      ready: true,
      currentVersion: "0007_runtime_retention_governance",
      requiredVersion: "0007_runtime_retention_governance",
      missing: []
    });
    expect(evaluateSchemaReadiness(REQUIRED_SCHEMA_MIGRATIONS.slice(0, -1))).toMatchObject({
      ready: false,
      currentVersion: "0006_agent_catalog",
      missing: ["0007_runtime_retention_governance"]
    });
  });

  it("reports an uninitialized database without inventing a version", () => {
    expect(evaluateSchemaReadiness([])).toMatchObject({ ready: false, currentVersion: null, missing: [...REQUIRED_SCHEMA_MIGRATIONS] });
  });
});
