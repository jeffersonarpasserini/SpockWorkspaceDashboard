REVOKE ALL ON SCHEMA spock FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA spock FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA spock FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA spock FROM PUBLIC;

GRANT USAGE ON SCHEMA spock TO :"spock_web_role", :"spock_worker_role";
GRANT ALL ON SCHEMA spock TO :"spock_migration_role";

GRANT SELECT ON
    spock.workspaces,
    spock.projects,
    spock.project_sources,
    spock.documents,
    spock.sync_runs,
    spock.spec_changes,
    spock.spec_requirements,
    spock.spec_scenarios,
    spock.spec_tasks,
    spock.external_bindings,
    spock.retention_policies
TO :"spock_web_role";

GRANT SELECT, INSERT, UPDATE ON
    spock.workspaces,
    spock.projects,
    spock.project_sources,
    spock.documents,
    spock.sync_runs,
    spock.spec_changes,
    spock.spec_requirements,
    spock.spec_scenarios,
    spock.spec_tasks,
    spock.external_bindings,
    spock.jobs,
    spock.outbox_events
TO :"spock_worker_role";

GRANT SELECT ON spock.retention_policies TO :"spock_worker_role";
GRANT INSERT ON spock.domain_events, spock.audit_events TO :"spock_worker_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA spock TO :"spock_worker_role";

GRANT ALL ON ALL TABLES IN SCHEMA spock TO :"spock_migration_role";
GRANT ALL ON ALL SEQUENCES IN SCHEMA spock TO :"spock_migration_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA spock TO :"spock_migration_role";
