BEGIN;

CREATE OR REPLACE FUNCTION spock.enforce_append_only_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, spock
AS $$
DECLARE
    configured_days integer;
    recorded timestamptz;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
    END IF;

    SELECT retention_days INTO configured_days
    FROM spock.retention_policies
    WHERE ledger = TG_TABLE_NAME;

    IF configured_days IS NULL THEN
        RAISE EXCEPTION 'retention policy missing for %', TG_TABLE_NAME USING ERRCODE = '55000';
    END IF;

    IF TG_TABLE_NAME = 'outbox_events' THEN
        recorded := OLD.created_at;
    ELSE
        recorded := OLD.recorded_at;
    END IF;

    IF recorded > clock_timestamp() - make_interval(days => configured_days) THEN
        RAISE EXCEPTION '% cannot be deleted before retention expires', TG_TABLE_NAME USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION spock.enforce_append_only_retention() FROM PUBLIC;

INSERT INTO spock.schema_migrations (version) VALUES ('0005_fix_retention_trigger_record_timestamp');

COMMIT;
