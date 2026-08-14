import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpenSpecTraceability } from "./OpenSpecTraceability";

describe("OpenSpecTraceability", () => {
  it("renders all persisted views with revision and conflict provenance", () => {
    render(<OpenSpecTraceability traceability={{
      projectId: "project",
      changes: [{
        id: "change",
        key: "add-control-plane",
        title: "Control plane",
        status: "active",
        sourceRevision: "abcdef1234567890",
        documents: [{ id: "document", kind: "proposal", title: "Proposal", relativePath: "openspec/changes/add-control-plane/proposal.md", contentHash: "hash", sourceRevision: "abcdef1234567890", missing: false }],
        requirements: [{ id: "requirement", ref: "control:R1", capability: "control", title: "Persist intent", body: "Body", sourceRevision: "abcdef1234567890", missing: false, scenarios: [{ id: "scenario", ref: "control:R1:S1", title: "Import", body: "Body", sourceRevision: "abcdef1234567890", missing: false }] }],
        tasks: [{ id: "task", ref: null, observedRef: "1.1", section: "Build", title: "Duplicate task", checked: false, identityStatus: "conflicted", sourceRevision: "abcdef1234567890", missing: false }]
      }]
    }} />);

    for (const name of ["Documents", "Specs", "Requirements", "Scenarios", "Tasks"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Duplicate task")).toBeInTheDocument();
    expect(screen.getByText(/1\.1 · Build · open · conflicted/)).toBeInTheDocument();
    expect(screen.getAllByText("rev abcdef123456").length).toBeGreaterThan(0);
  });

  it("is explicit when no persisted snapshot exists", () => {
    render(<OpenSpecTraceability traceability={null} />);
    expect(screen.getByText(/No persisted OpenSpec snapshot/)).toBeInTheDocument();
  });
});
