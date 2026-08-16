import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AgentsPage from "./page";

describe("AgentsPage", () => {
  it("shows canonical profiles and marks run analytics unavailable instead of inventing them", () => {
    render(<AgentsPage />);
    expect(screen.getByRole("heading", { name: "15 canonical agents" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Spock" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Miles O’Brien" })).toBeInTheDocument();
    expect(screen.getAllByText(/Unavailable until observed run evidence/)).toHaveLength(15);
  });
});
