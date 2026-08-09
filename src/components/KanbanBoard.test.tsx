import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KanbanBoard } from "./KanbanBoard";

const tasks = [
  { id: "h1", title: "Implement API", status: "running" as const, source: "hermes" as const, assignee: "data" },
  { id: "o1", title: "Validate release", status: "todo" as const, source: "openspec" as const, change: "add-dashboard", section: "Delivery" },
  { id: "h2", title: "Blocked deploy", status: "blocked" as const, source: "hermes" as const, blockedReason: "No credentials" }
];

describe("KanbanBoard", () => {
  it("renders native statuses and task provenance", () => {
    render(<KanbanBoard tasks={tasks} />);
    const running = screen.getByTestId("column-running");
    expect(within(running).getByText("Implement API")).toBeInTheDocument();
    expect(within(running).getByText("data")).toBeInTheDocument();
    const todo = screen.getByTestId("column-todo");
    expect(within(todo).getByText("add-dashboard")).toBeInTheDocument();
    const blocked = screen.getByTestId("column-blocked");
    expect(within(blocked).getByText("No credentials")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(7);
  });
});
