## ADDED Requirements

### Requirement: Recovery objectives are explicit and evidence-based

Every protected data tier SHALL declare approved RPO and RTO objectives, measurement boundaries, owner and dependencies. The system MUST distinguish target, last measured result and unproven status.

#### Scenario: No restore rehearsal exists for a tier
- **WHEN** recovery readiness is reported
- **THEN** the tier is marked unproven even if recent backup uploads succeeded

### Requirement: Backups are consistent, encrypted, signed and retention-aware

Backup bundles MUST use supported consistent snapshot mechanisms, authenticated encryption, externally managed envelope keys, signed manifests and checksummed inventories. Rotation and revocation MUST be documented and tested. Plaintext secrets and independent live SQLite/WAL/SHM copying MUST be rejected.

#### Scenario: Signature or authenticated decryption fails
- **WHEN** restore verifies a bundle
- **THEN** it fails before extracting data or requesting secret material

#### Scenario: Backup generation exceeds retention
- **WHEN** no valid hold applies
- **THEN** the generation and its wrapped data key expire according to the retention policy with sanitized evidence

### Requirement: Restore rehearsals prove recoverability periodically

The platform SHALL restore each critical tier into isolated fresh storage at an approved frequency and verify schema compatibility, migrations, ownership, counts, revisions, secret references, tombstones, readiness and smoke behavior. Results MUST record measured RPO/RTO without exposing data or keys.

#### Scenario: Restore completes but a source revision is missing
- **WHEN** validation compares the restored inventory
- **THEN** the rehearsal fails and cannot be used as cutover evidence

### Requirement: Cutover prevents split-brain writes

A VPS cutover MUST require final-sync, an explicit write freeze, a recorded terminal cursor/revision and a fencing mechanism that permits only one writable authority. Traffic change SHALL occur only after final verification.

#### Scenario: Old server remains writable
- **WHEN** cutover verification checks fencing
- **THEN** go-live is blocked even if the VPS health checks are green

### Requirement: Rollback is bounded and reconciles post-freeze writes

Rollback MUST define time and data-loss thresholds, fence the failed target before reopening the previous authority and reconcile or explicitly reject writes created after the freeze. It MUST NOT silently overwrite divergent histories.

#### Scenario: VPS accepted writes after cutover
- **WHEN** rollback is requested
- **THEN** the operator receives an explicit reconciliation decision and cannot simply enable the old writer

### Requirement: VPS execution remains separately authorized

This specification SHALL permit implementation and isolated rehearsal only. Provisioning, DNS/TLS changes, production secret injection, final freeze and real cutover MUST require a separate owner-approved operational change.

#### Scenario: Operator runs the rehearsal while VPS work is paused
- **WHEN** no production authorization exists
- **THEN** tools target only validated isolated destinations and refuse production endpoints

