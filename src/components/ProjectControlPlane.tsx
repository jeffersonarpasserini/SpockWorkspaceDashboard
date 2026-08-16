import type { BoardTask } from "@/lib/types";

const tabs = ["Overview", "Specs", "Tasks", "Runs", "Agents", "Documents", "Costs", "Timeline", "Settings"] as const;

export function ProjectTabs() {
  return (
    <nav className="project-tabs" aria-label="Project sections">
      {tabs.map((tab) => <a key={tab} href={`#project-${tab.toLowerCase()}`}>{tab}</a>)}
    </nav>
  );
}

function Unavailable({ label }: { label: string }) {
  return <span className="capability-unavailable" role="status">{label}: unavailable until persisted integration exists</span>;
}

export function ProjectCapabilityPanels() {
  return (
    <section className="capability-panels" aria-label="Project capability status">
      <section id="project-runs"><h2>Runs</h2><Unavailable label="Run history" /></section>
      <section id="project-agents"><h2>Agents</h2><Unavailable label="Observed assignments" /></section>
      <section id="project-documents"><h2>Documents</h2><Unavailable label="Document index" /></section>
      <section id="project-costs"><h2>Costs</h2><Unavailable label="Authoritative costs" /></section>
      <section id="project-timeline"><h2>Timeline</h2><Unavailable label="Persisted timeline" /></section>
      <section id="project-settings"><h2>Settings</h2><Unavailable label="Authorized settings" /></section>
    </section>
  );
}

export function TaskTraceability({ task }: { task: BoardTask | undefined }) {
  if (!task) return <section className="task-traceability" aria-label="Task traceability"><Unavailable label="Task traceability" /></section>;
  const rows = [
    ["Intent", task.change ? `${task.change}${task.section ? ` · ${task.section}` : ""}` : "unavailable"],
    ["Assignment", task.assignee ?? "unavailable"],
    ["Run", task.source === "hermes" ? `observed board item ${task.id}` : "unavailable"],
    ["Usage and cost", "unavailable"],
    ["Evidence", task.source === "openspec" ? "OpenSpec source projection" : "Hermes board observation"],
    ["Acceptance", task.status === "done" ? "implemented locally; human acceptance unavailable" : "unavailable"]
  ] as const;
  return (
    <section className="task-traceability" aria-labelledby="task-traceability-title">
      <div><span className="eyebrow">Task detail</span><h2 id="task-traceability-title">{task.title}</h2></div>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}
