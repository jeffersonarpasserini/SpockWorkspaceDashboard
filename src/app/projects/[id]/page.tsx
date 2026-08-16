import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { KanbanBoard } from "@/components/KanbanBoard";
import { RefreshButton } from "@/components/RefreshButton";
import { OpenSpecTraceability } from "@/components/OpenSpecTraceability";
import { ProjectCapabilityPanels, ProjectTabs, TaskTraceability } from "@/components/ProjectControlPlane";
import { createDefaultDashboardService } from "@/lib/dashboard";
import { loadOpenSpecTraceability } from "@/modules/openspec/load-traceability";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const projectId = (await params).id;
  let project;
  try {
    project = await createDefaultDashboardService().getProject(projectId);
  } catch {
    notFound();
  }
  const traceability = await loadOpenSpecTraceability(projectId);
  const total = project.openspec.checked + project.openspec.unchecked;
  return (
    <main>
      <section className="project-hero">
        <div><Link className="back-link" href="/">← Workspace</Link><span className="eyebrow">Project control room</span><h1>{project.name}</h1><p>Local status: <strong>{project.status.replaceAll("_", " ")}</strong>. This does not imply CI or release completion.</p></div>
        <RefreshButton />
      </section>
      <ProjectTabs />
      <section className="evidence-grid" id="project-overview" aria-label="Project evidence">
        <div><span>Git</span><strong>{project.git.branch ?? "Unavailable"}</strong><small>{project.git.dirty === undefined ? "No evidence" : project.git.dirty ? "Uncommitted changes" : "Clean worktree"}</small></div>
        <div><span>OpenSpec</span><strong>{project.openspec.checked} / {total}</strong><small>{project.openspec.changes} active changes</small></div>
        <div><span>Hermes board</span><strong>{project.hermes.board}</strong><small>{project.hermes.running} running · {project.hermes.blocked} blocked</small></div>
        <div><span>Observed</span><strong>{new Date(project.observedAt).toLocaleTimeString()}</strong><small>{new Date(project.observedAt).toLocaleDateString()}</small></div>
      </section>
      <section className="board-section" id="project-tasks"><div className="section-heading"><div><span className="eyebrow">Execution</span><h2>Agent and OpenSpec Kanban</h2></div><p>{project.tasks.length} work items</p></div><KanbanBoard tasks={project.tasks} /></section>
      <TaskTraceability task={project.tasks[0]} />
      <div id="project-specs"><OpenSpecTraceability traceability={traceability} /></div>
      <ProjectCapabilityPanels />
      <ChatPanel projectId={project.id} projectName={project.name} />
    </main>
  );
}
