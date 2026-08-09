import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/chat", () => {
  it("cancels an oversized chunked request before buffering the complete body", async () => {
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(60_000));
        if (pulls === 5) controller.close();
      },
      cancel() {
        cancelled = true;
      }
    });
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // Node's fetch implementation requires this for a streaming request body.
      duplex: "half"
    } as RequestInit);

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(5);
  });
});
