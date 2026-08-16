import { ProjectCard } from "@/components/ProjectCard";
import { RefreshButton } from "@/components/RefreshButton";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { createDefaultDashboardService } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await createDefaultDashboardService().listProjects();
  const active = projects.filter((project) => project.status === "in_progress" || project.status === "blocked").length;
  const blocked = projects.filter((project) => project.status === "blocked").length;
  const unavailableSources = projects.reduce((total, project) => total
    + [project.git.availability, project.openspec.availability, project.hermes.availability].filter((state) => state !== "available").length, 0);
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
      <PortfolioOverview projects={projects.length} activeWork={active + projects.reduce((sum, project) => sum + project.hermes.running, 0)} blockers={blocked} staleSources={unavailableSources} budgetState="unavailable" />
      <section className="project-section">
        <div className="section-heading"><div><span className="eyebrow">Portfolio</span><h2>Workspace projects</h2></div><p>Observed {projects[0] ? new Date(projects[0].observedAt).toLocaleString() : "now"}</p></div>
        {projects.length > 0 ? <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state"><h2>No projects found</h2><p>Set WORKSPACE_ROOT to a directory containing project folders.</p></div>}
      </section>
    </main>
  );
}
