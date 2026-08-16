## 1. Policy contract

- [x] 1.1 Inventory every durable, derived and ephemeral data class and its owning authority.
- [x] 1.2 RED: add table-driven tests requiring a complete, non-overlapping retention matrix.
- [ ] 1.3 Define initial periods, clocks, tombstones, purge deadlines and authorized hold roles; obtain privacy/security review before activation.

## 2. Planner and persistence

- [x] 2.1 RED: test lifecycle transitions, policy revision evidence and hold precedence with a controlled clock.
- [x] 2.2 Add retention policies, holds, tombstones, plans, claims and sanitized execution evidence through a forward-only migration.
- [x] 2.3 Implement dry-run planning and bounded idempotent claims without deleting content.

## 3. Executors and propagation

- [x] 3.1 RED: test partial failure, retry, concurrency, symlink escape and secret redaction.
- [ ] 3.2 Implement owned PostgreSQL/projection cleanup and run-root-contained ephemeral cleanup.
- [x] 3.3 Add typed external confirmation adapters and backup/restore tombstone reconciliation; keep unsupported adapters degraded.

## 4. Operations and gates

- [ ] 4.1 Add retention health, lag, holds and failure views with workspace authorization and accessibility checks.
- [ ] 4.2 Rehearse dry-run on production-shaped sanitized fixtures and independently review every destructive target.
- [ ] 4.3 Enable destructive scheduling only through a separate owner-approved activation gate with rollback and incident runbook.
- [ ] 4.4 Run unit, property, PostgreSQL, concurrency, security, browser, restore, lint, typecheck, build and strict OpenSpec validation.
