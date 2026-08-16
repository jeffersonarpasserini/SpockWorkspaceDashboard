import { describe, expect, it } from "vitest";
import { assertOpenSpecMutationAllowed, OPEN_SPEC_MUTATION_POLICY, OpenSpecMutationDisabledError } from "./mutation-policy";

describe("OpenSpec mutation hold", () => {
  it("is compile-time and runtime read-only without an environment bypass", () => {
    expect(OPEN_SPEC_MUTATION_POLICY).toEqual({
      enabled: false,
      mode: "read_only",
      requiredGate: "atomic_revision_checked_patch_and_strict_validation"
    });
    expect(() => assertOpenSpecMutationAllowed()).toThrow(OpenSpecMutationDisabledError);
    try {
      assertOpenSpecMutationAllowed();
    } catch (error) {
      expect(error).toMatchObject({ code: "OPENSPEC_MUTATION_DISABLED" });
    }
  });
});
