import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";

describe("ChatPanel", () => {
  it("sends a project message and renders the response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: "I am reviewing the board." }), { status: 200 }));
    const user = userEvent.setup();
    render(<ChatPanel projectId="QWxwaGE" projectName="Alpha" fetcher={fetcher} />);
    expect(screen.getByText(/not an execution sandbox/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/message to spock/i), "What is running?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("I am reviewing the board.")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
  });
});
