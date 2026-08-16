# PostgreSQL operations

Spock owns only its dedicated database and roles. None of these procedures may target the Agent
Orchestrator, Honcho or another application's database.

## Migrations and readiness

Set `SPOCK_DATABASE_URL` to the migration role and run:

```bash
npm run db:migrate
```

The runner takes a PostgreSQL session advisory lock, reads `spock.schema_migrations`, and applies
forward migrations in lexical order. Web and worker startup must call `assertSchemaReady` and refuse
readiness while a required version is missing. Never edit an applied migration; add the next numbered
file.

## Role boundaries

Cluster administration creates three login roles outside product migrations. Apply
`database/roles/least-privilege-grants.sql` with explicit `spock_web_role`, `spock_worker_role` and
`spock_migration_role` psql variables. Web receives projection reads only; worker receives bounded
domain writes and event inserts; migration receives DDL privileges. None may be a role used by Agent
Orchestrator or Honcho.

## Backup and restore rehearsal

Use explicit database names and a private temporary directory. The rehearsal target must be a new,
dedicated Spock database.

```bash
umask 077
rehearsal_dir="$(mktemp -d)"
pg_dump --format=custom --no-owner --no-acl --dbname="$SPOCK_DATABASE_URL" --file="$rehearsal_dir/spock.dump"
createdb spock_restore_rehearsal
pg_restore --exit-on-error --no-owner --no-acl --dbname=spock_restore_rehearsal "$rehearsal_dir/spock.dump"
psql --dbname=spock_restore_rehearsal --set=ON_ERROR_STOP=1 --command="SELECT version FROM spock.schema_migrations ORDER BY version"
dropdb spock_restore_rehearsal
```

Delete the private dump after verification. Record timestamp, source version, restored version,
duration and operator as audit evidence. A restore is not proven by `pg_dump` succeeding alone.

The local rehearsal on 2026-08-14 restored all five migrations and three retention policies into
`spock_restore_rehearsal_20260814`. The temporary database and private dump were removed immediately
after verification.

## Incident boundaries

- Stop Spock web/worker writes before a point-in-time recovery.
- Preserve database and worker logs as incident evidence with secrets redacted.
- Do not point Spock at `agent_orchestrator`, `honcho`, `postgres` or a shared application database.
- Restore into a new database first; validate migrations, row counts and OpenSpec projections before
  changing application credentials.
