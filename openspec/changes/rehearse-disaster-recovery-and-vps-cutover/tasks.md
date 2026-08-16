## 1. Objectives and inventory

- [ ] 1.1 Classify protected tiers and approve measurable RPO/RTO targets, owners and rehearsal frequency.
- [ ] 1.2 Map each tier to retention rules, consistency mechanism, dependency and secret reference.
- [ ] 1.3 RED: test missing objectives, stale evidence and unsupported backup mechanisms.

## 2. Protected backup

- [ ] 2.1 RED: test corruption, wrong key, signature failure, rotation, revoked keys and plaintext-secret rejection.
- [ ] 2.2 Implement signed manifests, envelope encryption and separate key/bundle storage adapters.
- [ ] 2.3 Implement consistent coordinated export and retention-aware generation expiry.

## 3. Restore rehearsal

- [ ] 3.1 RED: test isolated restore, incompatible versions, missing revisions/references and tombstone reconciliation.
- [ ] 3.2 Implement periodic isolated rehearsal with measured RPO/RTO and sanitized evidence.
- [ ] 3.3 Exercise restore and rollback on production-shaped fixtures; do not provision or contact a VPS.

## 4. Deferred cutover gate

- [ ] 4.1 Specify final-sync, write freeze, fencing token, go/no-go and divergent-write reconciliation.
- [ ] 4.2 Simulate cutover and rollback with two isolated writers and prove split-brain prevention.
- [ ] 4.3 Obtain independent operations/security review and strict OpenSpec validation.
- [ ] 4.4 Keep provisioning, DNS/TLS/Tailscale changes, production secrets and real cutover blocked until the owner creates and approves an operational change.

