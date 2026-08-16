BEGIN;

CREATE TABLE spock.retention_policies (
    ledger text PRIMARY KEY CHECK (ledger IN ('domain_events', 'audit_events', 'outbox_events')),
    retention_days integer NOT NULL CHECK (retention_days >= 30),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO spock.retention_policies (ledger, retention_days) VALUES
    ('domain_events', 365),
    ('audit_events', 730),
    ('outbox_events', 90);

CREATE FUNCTION spock.enforce_append_only_retention()
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

    recorded := CASE WHEN TG_TABLE_NAME = 'outbox_events' THEN OLD.created_at ELSE OLD.recorded_at END;
    IF recorded > clock_timestamp() - make_interval(days => configured_days) THEN
        RAISE EXCEPTION '% cannot be deleted before retention expires', TG_TABLE_NAME USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION spock.enforce_append_only_retention() FROM PUBLIC;

CREATE TRIGGER domain_events_append_only
BEFORE UPDATE OR DELETE ON spock.domain_events
FOR EACH ROW EXECUTE FUNCTION spock.enforce_append_only_retention();

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON spock.audit_events
FOR EACH ROW EXECUTE FUNCTION spock.enforce_append_only_retention();

CREATE TRIGGER outbox_events_retained_delete
BEFORE DELETE ON spock.outbox_events
FOR EACH ROW EXECUTE FUNCTION spock.enforce_append_only_retention();

CREATE INDEX jobs_expired_claim_idx
    ON spock.jobs (claimed_until, created_at)
    WHERE status = 'claimed';

INSERT INTO spock.schema_migrations (version) VALUES ('0004_event_retention_and_job_claims');

COMMIT;
