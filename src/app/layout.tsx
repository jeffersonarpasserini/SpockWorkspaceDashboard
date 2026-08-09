import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spock Workspace",
  description: "Workspace, OpenSpec and Hermes Agent supervision dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link className="brand" href="/"><span className="brand-mark">S</span><span>Spock Workspace</span></Link>
          <nav aria-label="Primary navigation"><Link href="/">Projects</Link><a href="https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban" target="_blank" rel="noreferrer">Hermes docs</a></nav>
          <span className="system-state"><span /> Local control plane</span>
        </header>
        {children}
      </body>
    </html>
  );
}
