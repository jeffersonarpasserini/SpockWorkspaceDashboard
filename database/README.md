# Spock PostgreSQL foundation

Spock uses its own PostgreSQL database and role. It must not reuse the Agent Orchestrator, Honcho or
another application's database credentials, even when they share one PostgreSQL instance.

For local development, copy `.env.example`, replace the placeholder password and start only the
database definition:

```bash
docker compose --env-file .env.local -f compose.database.yaml up -d
psql "$SPOCK_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0001_control_plane_foundation.sql
psql "$SPOCK_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0002_openspec_governance.sql
psql "$SPOCK_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0003_openspec_observed_references.sql
```

The migration intentionally creates application objects, not cluster roles or databases. An
operator creates web, worker and migration roles outside the repository and grants least privilege.
The first migration contains portfolio, source, sync, job, outbox and append-only event foundations;
later migrations add OpenSpec, team, runs, usage, prices and evidence as their vertical slices land.

Do not run Spock migrations against `agent_orchestrator`, `honcho` or any other application database.
