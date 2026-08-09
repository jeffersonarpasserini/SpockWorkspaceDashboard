import { KANBAN_STATUSES, type BoardTask, type KanbanStatus } from "@/lib/types";

const columnLabels: Record<KanbanStatus, string> = {
  triage: "Triage",
  todo: "Todo",
  ready: "Ready",
  running: "Running",
  blocked: "Blocked",
  done: "Done",
  archived: "Archived"
};

function TaskCard({ task }: { task: BoardTask }) {
  return (
    <article className={`task-card task-${task.status}`}>
      <div className="task-meta">
        <span className={`source-mark source-${task.source}`}>{task.source === "hermes" ? "Agent" : "OpenSpec"}</span>
        {task.priority !== undefined && <span className="priority">P{task.priority}</span>}
      </div>
      <h3>{task.title}</h3>
      {task.assignee && <span className="assignee"><span aria-hidden="true">◉</span> {task.assignee}</span>}
      {task.change && <span className="task-provenance">{task.change}</span>}
      {task.section && <span className="task-section">{task.section}</span>}
      {task.blockedReason && <p className="blocked-reason">{task.blockedReason}</p>}
    </article>
  );
}

export function KanbanBoard({ tasks }: { tasks: BoardTask[] }) {
  return (
    <div className="kanban" aria-label="Project Kanban board">
      {KANBAN_STATUSES.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <section className="kanban-column" data-testid={`column-${status}`} key={status}>
            <header>
              <span className={`column-dot dot-${status}`} aria-hidden="true" />
              <h2>{columnLabels[status]}</h2>
              <span className="column-count">{columnTasks.length}</span>
            </header>
            <div className="task-list">
              {columnTasks.length > 0 ? columnTasks.map((task) => <TaskCard key={task.id} task={task} />) : <p className="empty-column">No work</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
