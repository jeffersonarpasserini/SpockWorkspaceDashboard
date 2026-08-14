BEGIN;

CREATE TABLE spock.spec_changes (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES spock.projects(id),
    source_id uuid NOT NULL REFERENCES spock.project_sources(id),
    change_key text NOT NULL CHECK (change_key ~ '^[a-z0-9][a-z0-9-]*$'),
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'missing', 'conflicted')),
    source_revision text NOT NULL,
    missing_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (source_id, change_key)
);

CREATE TABLE spock.spec_requirements (
    id uuid PRIMARY KEY,
    change_id uuid NOT NULL REFERENCES spock.spec_changes(id),
    capability text NOT NULL,
    external_ref text,
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    body text NOT NULL DEFAULT '',
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    source_revision text NOT NULL,
    missing_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (change_id, external_ref)
);

CREATE TABLE spock.spec_scenarios (
    id uuid PRIMARY KEY,
    requirement_id uuid NOT NULL REFERENCES spock.spec_requirements(id),
    external_ref text,
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    body text NOT NULL DEFAULT '',
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    source_revision text NOT NULL,
    missing_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (requirement_id, external_ref)
);

CREATE TABLE spock.spec_tasks (
    id uuid PRIMARY KEY,
    change_id uuid NOT NULL REFERENCES spock.spec_changes(id),
    external_ref text,
    section text NOT NULL,
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    checked integer NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    source_revision text NOT NULL,
    identity_status text NOT NULL
        CHECK (identity_status IN ('stable', 'unstable', 'conflicted')),
    missing_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (change_id, external_ref)
);

CREATE TABLE spock.external_bindings (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES spock.projects(id),
    source_id uuid NOT NULL REFERENCES spock.project_sources(id),
    entity_type text NOT NULL
        CHECK (entity_type IN ('change', 'requirement', 'scenario', 'task', 'document')),
    external_key text NOT NULL CHECK (length(btrim(external_key)) > 0),
    entity_id uuid NOT NULL,
    provenance text NOT NULL
        CHECK (provenance IN ('hierarchical_ref', 'repository_binding', 'human_confirmed')),
    source_revision text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, entity_type, external_key),
    UNIQUE (source_id, entity_type, entity_id)
);

INSERT INTO spock.schema_migrations (version) VALUES ('0002_openspec_governance');

COMMIT;
