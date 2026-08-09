import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { KanbanBoard } from "@/components/KanbanBoard";
import { RefreshButton } from "@/components/RefreshButton";
import { createDefaultDashboardService } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  let project;
  try {
    project = await createDefaultDashboardService().getProject((await params).id);
  } catch {
    notFound();
  }
  const total = project.openspec.checked + project.openspec.unchecked;
  return (
    <main>
      <section className="project-hero">
        <div><Link className="back-link" href="/">← Workspace</Link><span className="eyebrow">Project control room</span><h1>{project.name}</h1><p>Local status: <strong>{project.status.replaceAll("_", " ")}</strong>. This does not imply CI or release completion.</p></div>
        <RefreshButton />
      </section>
      <section className="evidence-grid" aria-label="Project evidence">
        <div><span>Git</span><strong>{project.git.branch ?? "Unavailable"}</strong><small>{project.git.dirty === undefined ? "No evidence" : project.git.dirty ? "Uncommitted changes" : "Clean worktree"}</small></div>
        <div><span>OpenSpec</span><strong>{project.openspec.checked} / {total}</strong><small>{project.openspec.changes} active changes</small></div>
        <div><span>Hermes board</span><strong>{project.hermes.board}</strong><small>{project.hermes.running} running · {project.hermes.blocked} blocked</small></div>
        <div><span>Observed</span><strong>{new Date(project.observedAt).toLocaleTimeString()}</strong><small>{new Date(project.observedAt).toLocaleDateString()}</small></div>
      </section>
      <section className="board-section"><div className="section-heading"><div><span className="eyebrow">Execution</span><h2>Agent and OpenSpec Kanban</h2></div><p>{project.tasks.length} work items</p></div><KanbanBoard tasks={project.tasks} /></section>
      <ChatPanel projectId={project.id} projectName={project.name} />
    </main>
  );
}
