# Spock PostgreSQL foundation

Spock uses its own PostgreSQL database and role. It must not reuse the Agent Orchestrator, Honcho or
another application's database credentials, even when they share one PostgreSQL instance.

For local development, copy `.env.example`, replace the placeholder password and start only the
database definition:

```bash
docker compose --env-file .env.local -f compose.database.yaml up -d
npm run db:migrate
```

The migration intentionally creates application objects, not cluster roles or databases. An
operator creates web, worker and migration roles outside the repository and grants least privilege.
The first migration contains portfolio, source, sync, job, outbox and append-only event foundations;
later migrations add OpenSpec, team, runs, usage, prices and evidence as their vertical slices land.

Do not run Spock migrations against `agent_orchestrator`, `honcho` or any other application database.
See `docs/postgresql-operations.md` for readiness, backup/restore and incident procedures.
