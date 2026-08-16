// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("least-privilege PostgreSQL role contract", () => {
  it("does not create cluster roles and removes PUBLIC access", async () => {
    const grants = await readFile(path.join(process.cwd(), "database/roles/least-privilege-grants.sql"), "utf8");
    expect(grants).not.toMatch(/CREATE\s+(ROLE|USER|DATABASE)/i);
    expect(grants).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA spock FROM PUBLIC");
    expect(grants).toContain("REVOKE ALL ON ALL FUNCTIONS IN SCHEMA spock FROM PUBLIC");
  });

  it("keeps web read-only and grants append-only event insertion only to the worker", async () => {
    const grants = await readFile(path.join(process.cwd(), "database/roles/least-privilege-grants.sql"), "utf8");
    const webGrant = grants.slice(grants.indexOf("GRANT SELECT ON"), grants.indexOf('TO :"spock_web_role";') + 21);
    expect(webGrant).not.toMatch(/INSERT|UPDATE|DELETE/);
    expect(grants).toContain('GRANT INSERT ON spock.domain_events, spock.audit_events TO :"spock_worker_role"');
    expect(grants).not.toContain('GRANT UPDATE ON spock.domain_events');
    expect(grants).not.toContain('GRANT DELETE ON spock.audit_events');
  });
});
