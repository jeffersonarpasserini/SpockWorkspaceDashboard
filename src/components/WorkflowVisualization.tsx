import type { ManualWorkflowNode } from "@/modules/workflows/templates";

const labels: Record<ManualWorkflowNode["status"], string> = { planned: "Planned", waiting: "Waiting", running: "Running", blocked: "Blocked", completed: "Completed" };

export function WorkflowVisualization({ nodes }: { nodes: readonly ManualWorkflowNode[] }) {
  return <ol aria-label="Workflow progress">{nodes.map((node) => <li key={node.key} data-status={node.status}><strong>{node.key}</strong> <span>{labels[node.status]}</span>{node.blocker ? <p>{node.blocker}</p> : null}</li>)}</ol>;
}

