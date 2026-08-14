# ADR 0002: Source-of-truth boundaries

- Status: accepted
- Date: 2026-08-14

## Decision

- OpenSpec owns proposal, design, requirements, scenarios, task structure and checkbox state.
- Spock PostgreSQL owns durable IDs, bindings, assignments, acceptance, runs, usage, cost, evidence
  and audit history.
- Agent Orchestrator owns workflow execution and runtime financial gates.
- Hermes owns profiles, credentials, model routing and provider invocation.
- Phoenix/OpenTelemetry owns raw trace data; Spock stores correlation and evidence references.

No service reads or writes another service's private database. Divergence is displayed and reconciled;
it is not silently overwritten.
