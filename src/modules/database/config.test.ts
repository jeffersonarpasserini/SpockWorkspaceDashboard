import { describe, expect, it } from "vitest";
import { readDatabaseConfig } from "./config";

describe("database configuration", () => {
  it("requires a dedicated PostgreSQL URL", () => {
    expect(readDatabaseConfig({ SPOCK_DATABASE_URL: "postgresql://spock:secret@localhost:55432/spock" })).toEqual({
      url: "postgresql://spock:secret@localhost:55432/spock"
    });
  });

  it.each(["", "mysql://localhost/spock", "not-a-url"])("rejects invalid database URL %s", (url) => {
    expect(() => readDatabaseConfig({ SPOCK_DATABASE_URL: url })).toThrow();
  });
});
