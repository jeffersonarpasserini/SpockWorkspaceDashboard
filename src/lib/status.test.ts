import { describe, expect, it } from "vitest";
import { deriveProjectStatus } from "./status";

describe("project status derivation", () => {
  it("prioritizes blocked live work", () => {
    expect(deriveProjectStatus({ checked: 5, unchecked: 1, hermesStatuses: ["running", "blocked"], gitAvailable: true, openspecAvailable: true, hermesAvailable: true })).toBe("blocked");
  });

  it("marks mixed specification work as in progress", () => {
    expect(deriveProjectStatus({ checked: 2, unchecked: 3, hermesStatuses: [], gitAvailable: true, openspecAvailable: true, hermesAvailable: false })).toBe("in_progress");
  });

  it("marks an entirely unchecked OpenSpec backlog as in progress", () => {
    expect(deriveProjectStatus({ checked: 0, unchecked: 3, hermesStatuses: [], gitAvailable: true, openspecAvailable: true, hermesAvailable: false })).toBe("in_progress");
  });

  it("does not claim completion without evidence", () => {
    expect(deriveProjectStatus({ checked: 0, unchecked: 0, hermesStatuses: [], gitAvailable: false, openspecAvailable: false, hermesAvailable: false })).toBe("unknown");
  });

  it("uses complete_locally only when every observed task and source is complete", () => {
    expect(deriveProjectStatus({
      checked: 4,
      unchecked: 0,
      hermesStatuses: ["done"],
      gitAvailable: true,
      openspecAvailable: true,
      hermesAvailable: true
    })).toBe("complete_locally");
  });

  it.each([
    { gitAvailable: false, openspecAvailable: true, hermesAvailable: true },
    { gitAvailable: true, openspecAvailable: false, hermesAvailable: true },
    { gitAvailable: true, openspecAvailable: true, hermesAvailable: false }
  ])("does not claim completion when evidence is unavailable", (availability) => {
    expect(deriveProjectStatus({ checked: 4, unchecked: 0, hermesStatuses: ["done"], ...availability })).toBe("unknown");
  });
});
