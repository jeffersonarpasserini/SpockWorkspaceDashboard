"use client";

import { FormEvent, useState } from "react";

type Fetcher = typeof fetch;
interface Message { role: "user" | "assistant"; content: string }

export function ChatPanel({ projectId, projectName, fetcher = fetch }: { projectId: string; projectName: string; fetcher?: Fetcher }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setMessages((current) => [...current, { role: "user", content: text }]);
    setMessage("");
    setBusy(true);
    setError("");
    try {
      const response = await fetcher("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: text, history: messages.slice(-20) })
      });
      const payload = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error ?? "Hermes unavailable");
      setMessages((current) => [...current, { role: "assistant", content: payload.reply! }]);
    } catch {
      setError("Hermes is unavailable. Check the local API server configuration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat-panel" aria-labelledby="chat-title">
      <header>
        <div>
          <span className="eyebrow">Project channel</span>
          <h2 id="chat-title">Talk to Spock</h2>
        </div>
        <span className="project-pill">{projectName}</span>
      </header>
      <p className="chat-scope-note">Project context is supplied to Hermes as a prompt. This is not an execution sandbox; the local Hermes API process controls tool and filesystem permissions.</p>
      <div className="chat-transcript" aria-live="polite">
        {messages.length === 0 && <p className="chat-empty">Ask about priorities, blockers, architecture or the next executable step.</p>}
        {messages.map((entry, index) => <div className={`chat-message ${entry.role}`} key={`${entry.role}-${index}`}>{entry.content}</div>)}
        {busy && <div className="chat-message assistant">Reviewing project evidence…</div>}
      </div>
      {error && <p className="integration-error" role="alert">{error}</p>}
      <form onSubmit={submit}>
        <label htmlFor="spock-message">Message to Spock</label>
        <textarea id="spock-message" maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What should the agents work on next?" />
        <button className="primary-button" disabled={busy || !message.trim()} type="submit">Send</button>
      </form>
    </section>
  );
}
