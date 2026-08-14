import { describe, expect, it } from "vitest";
import { projectSlug } from "./catalog-repository";

describe("project catalog identity", () => {
  it.each([
    ["SpockWorkspaceDashboard", "spockworkspacedashboard"],
    ["Qualitas System", "qualitas-system"],
    ["Gestão Clínica", "gestao-clinica"],
    ["---", "project"]
  ])("normalizes %s to %s", (name, expected) => {
    expect(projectSlug(name)).toBe(expected);
  });
});
