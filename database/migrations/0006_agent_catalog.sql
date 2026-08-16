BEGIN;

CREATE TABLE spock.agents (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    agent_key text NOT NULL CHECK (agent_key ~ '^[a-z0-9][a-z0-9-]*$'),
    display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'retired')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (workspace_id, agent_key)
);

CREATE TABLE spock.agent_profile_versions (
    id uuid PRIMARY KEY,
    agent_id uuid NOT NULL REFERENCES spock.agents(id),
    profile_version integer NOT NULL CHECK (profile_version > 0),
    external_profile text NOT NULL CHECK (length(btrim(external_profile)) > 0),
    provider text NOT NULL CHECK (length(btrim(provider)) > 0),
    model text NOT NULL CHECK (length(btrim(model)) > 0),
    billing_mode text NOT NULL,
    configuration_hash text NOT NULL CHECK (configuration_hash ~ '^[0-9a-f]{64}$'),
    capabilities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
    observed_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (agent_id, profile_version),
    UNIQUE (agent_id, configuration_hash)
);

CREATE TABLE spock.team_roles (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES spock.workspaces(id),
    role_key text NOT NULL CHECK (role_key ~ '^[a-z0-9][a-z0-9-]*$'),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    responsibility text NOT NULL CHECK (length(btrim(responsibility)) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (workspace_id, role_key)
);

CREATE TABLE spock.agent_project_scopes (
    id uuid PRIMARY KEY,
    agent_id uuid NOT NULL REFERENCES spock.agents(id),
    project_id uuid NOT NULL REFERENCES spock.projects(id),
    policy text NOT NULL DEFAULT 'allow' CHECK (policy IN ('allow', 'deny')),
    capabilities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (agent_id, project_id)
);

CREATE TABLE spock.team_role_assignments (
    id uuid PRIMARY KEY,
    role_id uuid NOT NULL REFERENCES spock.team_roles(id),
    agent_id uuid NOT NULL REFERENCES spock.agents(id),
    project_id uuid REFERENCES spock.projects(id),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX team_role_assignments_active_idx
    ON spock.team_role_assignments (role_id, project_id, starts_at);

CREATE OR REPLACE FUNCTION spock.reject_profile_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'agent profile versions are immutable';
END;
$$;

CREATE TRIGGER agent_profile_versions_immutable
BEFORE UPDATE OR DELETE ON spock.agent_profile_versions
FOR EACH ROW EXECUTE FUNCTION spock.reject_profile_version_mutation();

INSERT INTO spock.schema_migrations (version) VALUES ('0006_agent_catalog');

COMMIT;
