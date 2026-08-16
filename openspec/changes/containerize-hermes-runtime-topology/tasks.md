## 1. Inventory and contracts

- [ ] 1.1 Inventory the effective host/container topology, ownership, ports, networks, volumes, health and secret-reference inputs.
- [ ] 1.2 RED: add topology tests for duplicate ownership, public bindings, shared database identities and missing dependencies.
- [ ] 1.3 Define per-profile behavioral contracts, preserving OpenAI/Codex subscription and Alibaba Token Plan semantics.

## 2. Equivalence harness

- [ ] 2.1 RED: compare host and candidate fixtures for identity, model/provider, billing, sessions, tools, stream, cancel and recovery.
- [ ] 2.2 Implement a non-dispatching, sanitized equivalence harness with bounded/non-billable probes.
- [ ] 2.3 Rehearse every approved profile; retain incompatible profiles on the host without fallback.

## 3. Candidate topology

- [ ] 3.1 RED: test dependency ordering, private networks, isolated identities, secret exclusion, volumes and health/readiness.
- [ ] 3.2 Add candidate Compose/release manifests in render-and-verify-only mode.
- [ ] 3.3 Add compatible backup/restore, upgrade/downgrade and mixed host/container rollback plans.

## 4. Deferred activation gate

- [ ] 4.1 Run restart, crash, corruption, secret scanning, backup/restore and soak tests without production dispatch.
- [ ] 4.2 Obtain independent security, operations and provider-access equivalence review.
- [ ] 4.3 Validate OpenSpec strictly and retain executable proof per profile.
- [ ] 4.4 Create a separate owner-approved activation change before starting definitive containers, moving credentials or switching profile traffic.

