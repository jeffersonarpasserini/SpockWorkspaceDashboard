# ADR 0001: TypeScript control plane with a separate worker

- Status: accepted
- Date: 2026-08-14

## Context

The existing product is a tested Next.js and TypeScript application. Its next requirement is a
durable domain, synchronization and accounting model. Rewriting the UI and secure filesystem
adapters in another language would add migration risk before the domain contracts are proven.

## Decision

Use Next.js/React for UI and HTTP APIs, framework-independent TypeScript domain modules and a
separate Node.js worker. Use PostgreSQL as the durable store and transactional job/outbox mechanism.
Keep Python/LangGraph in the external Agent Orchestrator service. Reserve Go for a future remote
execution daemon if multi-host execution requires a small distributable binary.

## Consequences

- Web requests will not own long-running scans or agent processes.
- Domain modules cannot import React, Next.js or provider SDKs.
- Spock does not duplicate LangGraph orchestration.
- A future daemon integrates through a versioned protocol rather than sharing application code.
