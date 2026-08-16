import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortfolioOverview } from "./PortfolioOverview";

describe("PortfolioOverview", () => {
  it("renders budget and stale state as text rather than color alone", () => {
    render(<PortfolioOverview projects={3} activeWork={2} blockers={1} staleSources={4} budgetState="unavailable" />);
    expect(screen.getByRole("region", { name: "Portfolio status" })).toHaveTextContent("unavailable");
    expect(screen.getByText("Stale or unavailable sources")).toBeVisible();
  });
});
