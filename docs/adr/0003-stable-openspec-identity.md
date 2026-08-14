# ADR 0003: Stable OpenSpec task identity

- Status: accepted
- Date: 2026-08-14

## Context

The MVP hashes change, section and title. Renaming or moving a task therefore creates a new identity
and makes historical attribution unreliable.

## Decision

Resolve identity from an explicit hierarchical task reference, then a repository-local
`.spock/bindings.json` entry, then a previously confirmed source anchor. Titles and sections are
mutable. Ambiguous observations are marked `unstable_identity` and cannot receive execution history
until confirmed. Missing tasks are tombstoned rather than deleted.

## Consequences

OpenSpec authors should retain hierarchical references. Sync must report conflicts and never guess
when more than one match is possible.
