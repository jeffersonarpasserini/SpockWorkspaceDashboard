BEGIN;

CREATE SCHEMA IF NOT EXISTS spock;

CREATE TABLE spock.schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE spock.workspaces (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE spock.projects (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (workspace_id, slug),
    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE spock.project_sources (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES spock.projects(id),
    kind text NOT NULL CHECK (kind IN ('filesystem', 'git', 'openspec', 'hermes', 'github', 'gitlab')),
    external_id text,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    sync_status text NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'syncing', 'available', 'stale', 'unavailable')),
    last_successful_sync_at timestamptz,
    last_attempted_sync_at timestamptz,
    source_revision text,
    sanitized_error_class text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE NULLS NOT DISTINCT (project_id, kind, external_id)
);

CREATE TABLE spock.documents (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES spock.projects(id),
    source_id uuid NOT NULL REFERENCES spock.project_sources(id),
    kind text NOT NULL,
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    relative_path text NOT NULL CHECK (relative_path <> '' AND relative_path !~ '(^|/)\.\.(/|$)'),
    content_hash text NOT NULL,
    source_revision text,
    last_indexed_at timestamptz NOT NULL,
    missing_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (source_id, relative_path)
);

CREATE TABLE spock.sync_runs (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES spock.project_sources(id),
    status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
    source_revision text,
    result_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    sanitized_error_class text,
    started_at timestamptz NOT NULL,
    finished_at timestamptz,
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE spock.domain_events (
    sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id uuid NOT NULL UNIQUE,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    project_id uuid REFERENCES spock.projects(id),
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_type text NOT NULL,
    actor_id text NOT NULL,
    correlation_id text,
    causation_id uuid,
    payload jsonb NOT NULL,
    occurred_at timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE spock.jobs (
    id uuid PRIMARY KEY,
    kind text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'claimed', 'retry_scheduled', 'succeeded', 'dead_letter')),
    available_at timestamptz NOT NULL DEFAULT now(),
    claimed_by text,
    claimed_until timestamptz,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    last_error_class text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((status = 'claimed') = (claimed_by IS NOT NULL AND claimed_until IS NOT NULL))
);

CREATE INDEX jobs_claimable_idx
    ON spock.jobs (available_at, created_at)
    WHERE status IN ('queued', 'retry_scheduled');

CREATE TABLE spock.outbox_events (
    sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id uuid NOT NULL UNIQUE,
    topic text NOT NULL,
    event_key text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0)
);

CREATE INDEX outbox_unpublished_idx
    ON spock.outbox_events (sequence)
    WHERE published_at IS NULL;

CREATE TABLE spock.audit_events (
    sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id uuid NOT NULL UNIQUE,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    project_id uuid REFERENCES spock.projects(id),
    actor_type text NOT NULL,
    actor_id text NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    request_id text,
    payload jsonb NOT NULL,
    occurred_at timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO spock.schema_migrations (version) VALUES ('0001_control_plane_foundation');

COMMIT;
