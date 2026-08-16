export const OPEN_SPEC_MUTATION_POLICY = Object.freeze({
  enabled: false as const,
  mode: "read_only" as const,
  requiredGate: "atomic_revision_checked_patch_and_strict_validation" as const
});

export class OpenSpecMutationDisabledError extends Error {
  readonly code = "OPENSPEC_MUTATION_DISABLED";

  constructor() {
    super("OpenSpec mutation requires a separately approved atomic revision-checked patch gate");
    this.name = "OpenSpecMutationDisabledError";
  }
}

export function assertOpenSpecMutationAllowed(): never {
  throw new OpenSpecMutationDisabledError();
}
