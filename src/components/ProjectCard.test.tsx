import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectCard } from "./ProjectCard";
import type { ProjectSummary } from "@/lib/types";

const project: ProjectSummary = {
  id: "QWxwaGE",
  name: "Alpha",
  markers: [".git", "openspec"],
  git: { availability: "available", branch: "main", dirty: false },
  openspec: { availability: "available", checked: 3, unchecked: 2, changes: 1 },
  hermes: { availability: "available", board: "alpha", running: 1, blocked: 0 },
  status: "in_progress",
  observedAt: "2026-08-09T00:00:00.000Z"
};

describe("ProjectCard", () => {
  it("shows evidence, progress and a project link", () => {
    render(<ProjectCard project={project} />);
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByText("3 / 5 tasks")).toBeInTheDocument();
    expect(screen.getByText("1 agent active")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open alpha/i })).toHaveAttribute("href", "/projects/QWxwaGE");
  });
});
