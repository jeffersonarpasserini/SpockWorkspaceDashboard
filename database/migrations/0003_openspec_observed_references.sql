BEGIN;

ALTER TABLE spock.spec_tasks
    ADD COLUMN observed_ref text;

UPDATE spock.spec_tasks
SET observed_ref = external_ref
WHERE external_ref IS NOT NULL;

ALTER TABLE spock.spec_tasks
    ADD CONSTRAINT spec_tasks_stable_ref_consistent
    CHECK (identity_status <> 'stable' OR external_ref IS NOT NULL);

INSERT INTO spock.schema_migrations (version) VALUES ('0003_openspec_observed_references');

COMMIT;
