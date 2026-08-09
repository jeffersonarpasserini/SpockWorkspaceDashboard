import Link from "next/link";
import type { ProjectStatus, ProjectSummary } from "@/lib/types";

const labels: Record<ProjectStatus, string> = {
  blocked: "Blocked",
  in_progress: "In progress",
  complete_locally: "Complete locally",
  unknown: "Unknown"
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const total = project.openspec.checked + project.openspec.unchecked;
  const progress = total > 0 ? Math.round((project.openspec.checked / total) * 100) : 0;
  return (
    <article className="project-card">
      <div className="card-topline">
        <span className={`status-dot status-${project.status}`} aria-hidden="true" />
        <span className="eyebrow">{labels[project.status]}</span>
        <span className="branch mono">{project.git.branch ?? "git unavailable"}</span>
      </div>
      <h2>{project.name}</h2>
      <p className="muted">{project.markers.join(" · ")}</p>
      <div className="progress-track" aria-label={`${progress}% OpenSpec progress`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="metric-row">
        <span><strong>{project.openspec.checked} / {total} tasks</strong></span>
        <span><strong>{project.hermes.running} {project.hermes.running === 1 ? "agent active" : "agents active"}</strong></span>
      </div>
      <div className="source-row">
        <span className={`source-chip ${project.git.availability}`}>Git</span>
        <span className={`source-chip ${project.openspec.availability}`}>OpenSpec</span>
        <span className={`source-chip ${project.hermes.availability}`}>Hermes</span>
      </div>
      <Link className="card-link" href={`/projects/${project.id}`} aria-label={`Open ${project.name}`}>
        Open project <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
