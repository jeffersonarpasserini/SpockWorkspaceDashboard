# ADR 0004: Agent Orchestrator integration hold

- Status: accepted
- Date: 2026-08-14

## Context

Agent Orchestrator is still under active development. Its documentation describes a broader
multiagent workflow than the currently compiled LangGraph. Coupling Spock to that moving boundary
would affect both projects and create misleading capability claims.

## Decision

Until the owner explicitly announces Agent Orchestrator completion and authorizes integration:

- do not modify, deploy or migrate Agent Orchestrator;
- do not call its live APIs or consume live events;
- do not share its database or PostgreSQL user;
- use versioned local fixtures and `FakeOrchestratorAdapter`;
- keep all live integration and dispatch flags disabled by default;
- treat observed contract details as provisional.

## Exit criteria

The owner explicitly lifts the hold, after which a separately reviewed observation-only contract
gate must pass before any live dispatch is considered.
