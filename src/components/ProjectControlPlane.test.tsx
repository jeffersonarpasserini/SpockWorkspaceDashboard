import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectCapabilityPanels, ProjectTabs, TaskTraceability } from "./ProjectControlPlane";

describe("project control-plane navigation", () => {
  it("provides keyboard-focusable links for every required project section", () => {
    render(<ProjectTabs />);
    expect(screen.getAllByRole("link")).toHaveLength(9);
    expect(screen.getByRole("link", { name: "Costs" })).toHaveAttribute("href", "#project-costs");
  });

  it("uses semantic unavailable states instead of invented data", () => {
    render(<ProjectCapabilityPanels />);
    expect(screen.getAllByRole("status")).toHaveLength(6);
    expect(screen.getByText(/Authoritative costs: unavailable/)).toBeVisible();
  });

  it("traces intent through acceptance and keeps missing stages explicit", () => {
    render(<TaskTraceability task={{ id: "task-1", title: "Implement slice", status: "done", source: "openspec", change: "control-plane", section: "11.1" }} />);
    expect(screen.getByText("Intent")).toBeVisible();
    expect(screen.getByText("Usage and cost")).toBeVisible();
    expect(screen.getByText("implemented locally; human acceptance unavailable")).toBeVisible();
  });
});
