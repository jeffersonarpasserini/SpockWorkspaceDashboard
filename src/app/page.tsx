import { ProjectCard } from "@/components/ProjectCard";
import { RefreshButton } from "@/components/RefreshButton";
import { createDefaultDashboardService } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await createDefaultDashboardService().listProjects();
  const active = projects.filter((project) => project.status === "in_progress" || project.status === "blocked").length;
  const blocked = projects.filter((project) => project.status === "blocked").length;
  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow">Workspace intelligence</span>
          <h1>Projects, agents and evidence.<br /><span>One operational view.</span></h1>
          <p>Supervise local repositories, OpenSpec progress and durable Hermes Kanban work without confusing implementation with completion.</p>
        </div>
        <RefreshButton />
      </section>
      <section className="summary-strip" aria-label="Workspace summary">
        <div><strong>{projects.length}</strong><span>Projects discovered</span></div>
        <div><strong>{active}</strong><span>Active or blocked</span></div>
        <div><strong>{blocked}</strong><span>Blocked projects</span></div>
        <div><strong>{projects.reduce((sum, project) => sum + project.hermes.running, 0)}</strong><span>Agents working now</span></div>
      </section>
      <section className="project-section">
        <div className="section-heading"><div><span className="eyebrow">Portfolio</span><h2>Workspace projects</h2></div><p>Observed {projects[0] ? new Date(projects[0].observedAt).toLocaleString() : "now"}</p></div>
        {projects.length > 0 ? <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state"><h2>No projects found</h2><p>Set WORKSPACE_ROOT to a directory containing project folders.</p></div>}
      </section>
    </main>
  );
}
