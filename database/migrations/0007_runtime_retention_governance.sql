BEGIN;

CREATE TABLE spock.retention_policy_versions (
    id uuid PRIMARY KEY,
    data_class text NOT NULL CHECK (data_class IN (
        'domain_events', 'runs_and_turns', 'sessions', 'usage_and_costs', 'audit_events',
        'observations_and_traces', 'application_and_container_logs', 'ephemeral_worktrees',
        'workspace_exports', 'backups'
    )),
    policy_revision integer NOT NULL CHECK (policy_revision > 0),
    authority text NOT NULL CHECK (authority IN ('control_plane', 'orchestrator', 'hermes', 'observability', 'filesystem', 'backup_operator')),
    classification text NOT NULL CHECK (classification IN ('operational', 'confidential', 'financial', 'security_audit')),
    retention_clock text NOT NULL CHECK (retention_clock IN ('recorded_at', 'terminal_at', 'last_activity_at', 'created_at', 'generation_at')),
    active_days integer NOT NULL CHECK (active_days >= 0),
    tombstone_days integer NOT NULL CHECK (tombstone_days >= 0),
    purge_within_days integer NOT NULL CHECK (purge_within_days > 0),
    confirmation_mode text NOT NULL CHECK (confirmation_mode IN ('owned', 'external_confirmation')),
    derived_copies jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(derived_copies) = 'array'),
    effective_at timestamptz NOT NULL,
    retired_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (retired_at IS NULL OR retired_at > effective_at),
    UNIQUE (data_class, policy_revision)
);

CREATE TABLE spock.retention_holds (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    data_class text NOT NULL,
    target_id text NOT NULL CHECK (length(btrim(target_id)) > 0),
    authorized_by text NOT NULL CHECK (length(btrim(authorized_by)) > 0),
    reason_code text NOT NULL CHECK (reason_code ~ '^[a-z0-9][a-z0-9_-]*$'),
    starts_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    released_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > starts_at),
    CHECK (released_at IS NULL OR released_at >= starts_at)
);

CREATE INDEX retention_holds_active_idx
    ON spock.retention_holds (workspace_id, data_class, target_id, expires_at)
    WHERE released_at IS NULL;

CREATE TABLE spock.retention_tombstones (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    data_class text NOT NULL,
    target_id_hash text NOT NULL CHECK (target_id_hash ~ '^[0-9a-f]{64}$'),
    policy_revision integer NOT NULL CHECK (policy_revision > 0),
    deleted_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at >= deleted_at),
    UNIQUE (workspace_id, data_class, target_id_hash)
);

CREATE TABLE spock.retention_plans (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
    policy_revision_set_hash text NOT NULL CHECK (policy_revision_set_hash ~ '^[0-9a-f]{64}$'),
    dry_run integer NOT NULL DEFAULT 1 CHECK (dry_run IN (0, 1)),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'partial', 'failed', 'cancelled')),
    planned_at timestamptz NOT NULL,
    completed_at timestamptz,
    sanitized_error_class text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (completed_at IS NULL OR completed_at >= planned_at),
    UNIQUE (workspace_id, idempotency_key)
);

CREATE TABLE spock.retention_plan_items (
    id uuid PRIMARY KEY,
    plan_id uuid NOT NULL REFERENCES spock.retention_plans(id),
    data_class text NOT NULL,
    target_id_hash text NOT NULL CHECK (target_id_hash ~ '^[0-9a-f]{64}$'),
    decision text NOT NULL CHECK (decision IN ('active', 'expired', 'tombstoned', 'purge_due', 'held', 'blocked')),
    confirmation_state text NOT NULL DEFAULT 'pending' CHECK (confirmation_state IN ('pending', 'confirmed', 'unsupported', 'failed', 'not_required')),
    claimed_by text,
    claimed_until timestamptz,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    sanitized_error_class text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((claimed_by IS NULL) = (claimed_until IS NULL)),
    UNIQUE (plan_id, data_class, target_id_hash)
);

CREATE INDEX retention_plan_items_claim_idx
    ON spock.retention_plan_items (plan_id, confirmation_state, claimed_until, created_at);

CREATE OR REPLACE FUNCTION spock.reject_retention_policy_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'retention policy versions are immutable';
END;
$$;

CREATE TRIGGER retention_policy_versions_immutable
BEFORE UPDATE OR DELETE ON spock.retention_policy_versions
FOR EACH ROW EXECUTE FUNCTION spock.reject_retention_policy_version_mutation();

INSERT INTO spock.schema_migrations (version) VALUES ('0007_runtime_retention_governance');

COMMIT;
