import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowVisualization } from "./WorkflowVisualization";

describe("WorkflowVisualization", () => {
  it("distinguishes every state with semantic text instead of color alone", () => {
    render(<WorkflowVisualization nodes={[
      { key: "one", status: "planned", correctionCount: 0, blocker: null, handoff: null },
      { key: "two", status: "waiting", correctionCount: 0, blocker: null, handoff: null },
      { key: "three", status: "running", correctionCount: 0, blocker: null, handoff: null },
      { key: "four", status: "blocked", correctionCount: 3, blocker: "human review", handoff: null },
      { key: "five", status: "completed", correctionCount: 0, blocker: null, handoff: null }
    ]} />);
    expect(screen.getByRole("list", { name: "Workflow progress" })).toBeInTheDocument();
    for (const label of ["Planned", "Waiting", "Running", "Blocked", "Completed"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("human review")).toBeInTheDocument();
  });
});

