import { describe, expect, it } from "vitest";
import { assertRunTransition, assertSpecChangeTransition, assertTaskTransition, canTransitionTask } from "./lifecycle";

describe("control-plane lifecycles", () => {
  it("separates implementation, validation, review and acceptance", () => {
    expect(canTransitionTask("running", "implemented")).toBe(true);
    expect(canTransitionTask("implemented", "accepted")).toBe(false);
    expect(canTransitionTask("implemented", "validating")).toBe(true);
    expect(canTransitionTask("validating", "review")).toBe(true);
    expect(canTransitionTask("review", "accepted")).toBe(true);
  });

  it("permits explicit rework without erasing accepted history", () => {
    expect(() => assertTaskTransition("accepted", "running")).not.toThrow();
  });

  it("does not allow successful runs to become active again", () => {
    expect(() => assertRunTransition("succeeded", "running")).toThrow("Invalid run transition");
  });

  it("keeps implementation, validation and release distinct for specs", () => {
    expect(() => assertSpecChangeTransition("implemented", "validated")).not.toThrow();
    expect(() => assertSpecChangeTransition("implemented", "released")).toThrow("Invalid spec change transition");
  });
});
