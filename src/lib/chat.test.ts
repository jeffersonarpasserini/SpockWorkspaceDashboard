import { describe, expect, it, vi } from "vitest";
import { createHermesChatClient, readBoundedBody } from "./chat";

describe("Hermes chat client", () => {
  it("sends a project-scoped request without exposing the token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Ready" } }] }), { status: 200 }));
    const client = createHermesChatClient({ apiUrl: "http://localhost:8642", apiKey: "secret", fetcher });

    await expect(client.send("QualitasSystem", "What is next?", "/workspace/QualitasSystem", [
      { role: "user", content: "Summarize the project" },
      { role: "assistant", content: "It is active." }
    ])).resolves.toBe("Ready");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("http://localhost:8642/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer secret");
    expect(init.body).toContain("QualitasSystem");
    expect(init.body).toContain("/workspace/QualitasSystem");
    expect(JSON.parse(init.body).messages.map((entry: { role: string }) => entry.role)).toEqual(["system", "user", "assistant", "user"]);
  });

  it("fails clearly when the API is not configured", async () => {
    const client = createHermesChatClient({ apiUrl: "", apiKey: "", fetcher: vi.fn() });
    await expect(client.send("Project", "Hello")).rejects.toThrow(/not configured/i);
  });

  it("rejects oversized input before making a request", async () => {
    const fetcher = vi.fn();
    const client = createHermesChatClient({ apiUrl: "http://localhost:8642", apiKey: "", fetcher });
    await expect(client.send("Project", "x".repeat(4001))).rejects.toThrow(/4000/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("stops reading an oversized streaming API response", async () => {
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(600_000));
        if (pulls === 5) controller.close();
      },
      cancel() {
        cancelled = true;
      }
    });
    const fetcher = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    const client = createHermesChatClient({ apiUrl: "http://localhost:8642", apiKey: "", fetcher });
    await expect(client.send("Project", "Hello")).rejects.toThrow(/too large/i);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(5);
  });

  it("cancels a declared-oversized body before rejecting it", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      }
    });
    const response = new Response(body, { headers: { "Content-Length": "1000001" } });

    await expect(readBoundedBody(response, 1_000_000, "too large")).rejects.toThrow(/too large/i);
    expect(cancelled).toBe(true);
  });

  it("redacts the verified project and workspace roots if Hermes echoes them", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Workspace /workspace; inspect /workspace/QualitasSystem/src next." } }] }), { status: 200 }));
    const client = createHermesChatClient({ apiUrl: "http://localhost:8642", apiKey: "", fetcher });
    await expect(client.send("QualitasSystem", "Next?", "/workspace/QualitasSystem")).resolves.toBe("Workspace [WORKSPACE_ROOT]; inspect [PROJECT_ROOT]/src next.");
  });
});
