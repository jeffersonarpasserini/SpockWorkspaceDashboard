import type { OpenSpecTraceability as Traceability } from "@/modules/openspec/read-model";

export function OpenSpecTraceability({ traceability }: { traceability: Traceability | null }) {
  return (
    <section className="openspec-section" id="openspec-persisted" aria-labelledby="openspec-title">
      <div className="section-heading">
        <div><span className="eyebrow">Persisted intent</span><h2 id="openspec-title">OpenSpec traceability</h2></div>
        <p>Read-only · PostgreSQL projection</p>
      </div>
      {!traceability || traceability.changes.length === 0 ? (
        <div className="empty-state">No persisted OpenSpec snapshot is available. Filesystem evidence remains visible above.</div>
      ) : traceability.changes.map((change) => (
        <article className="openspec-change" key={change.id}>
          <header>
            <div><span className="source-mark source-openspec">{change.status}</span><h3>{change.title}</h3><code>{change.key}</code></div>
            <Revision value={change.sourceRevision} />
          </header>
          <nav className="traceability-tabs" aria-label={`${change.title} OpenSpec views`}>
            <a href={`#${change.id}-documents`}>Documents <span>{change.documents.length}</span></a>
            <a href={`#${change.id}-specs`}>Specs <span>{new Set(change.requirements.map((item) => item.capability)).size}</span></a>
            <a href={`#${change.id}-requirements`}>Requirements <span>{change.requirements.length}</span></a>
            <a href={`#${change.id}-scenarios`}>Scenarios <span>{change.requirements.reduce((total, item) => total + item.scenarios.length, 0)}</span></a>
            <a href={`#${change.id}-tasks`}>Tasks <span>{change.tasks.length}</span></a>
          </nav>
          <div className="traceability-grid">
            <section id={`${change.id}-documents`}><h4>Documents</h4>{change.documents.map((document) => (
              <TraceRow key={document.id} title={document.title} meta={`${document.kind} · ${document.relativePath}`} revision={document.sourceRevision} missing={document.missing} />
            ))}</section>
            <section id={`${change.id}-specs`}><h4>Specs</h4>{[...new Set(change.requirements.map((item) => item.capability))].map((capability) => (
              <TraceRow key={capability} title={capability} meta={`${change.requirements.filter((item) => item.capability === capability).length} requirements`} revision={change.sourceRevision} />
            ))}</section>
            <section id={`${change.id}-requirements`}><h4>Requirements</h4>{change.requirements.map((requirement) => (
              <TraceRow key={requirement.id} title={requirement.title} meta={`${requirement.ref ?? "unbound"} · ${requirement.capability}`} revision={requirement.sourceRevision} missing={requirement.missing} />
            ))}</section>
            <section id={`${change.id}-scenarios`}><h4>Scenarios</h4>{change.requirements.flatMap((requirement) => requirement.scenarios.map((scenario) => (
              <TraceRow key={scenario.id} title={scenario.title} meta={`${scenario.ref ?? "unbound"} · ${requirement.title}`} revision={scenario.sourceRevision} missing={scenario.missing} />
            )))}</section>
            <section id={`${change.id}-tasks`}><h4>Tasks</h4>{change.tasks.map((task) => (
              <TraceRow key={task.id} title={task.title} meta={`${task.ref ?? task.observedRef ?? "unbound"} · ${task.section} · ${task.checked ? "checked" : "open"} · ${task.identityStatus}`} revision={task.sourceRevision} missing={task.missing} />
            ))}</section>
          </div>
        </article>
      ))}
    </section>
  );
}

function Revision({ value }: { value: string | null }) {
  return <span className="source-revision" title={value ?? "No source revision"}>rev {value ? value.slice(0, 12) : "unavailable"}</span>;
}

function TraceRow({ title, meta, revision, missing = false }: { title: string; meta: string; revision: string | null; missing?: boolean }) {
  return <div className={`trace-row${missing ? " trace-missing" : ""}`}><div><strong>{title}</strong><small>{meta}</small></div><Revision value={revision} /></div>;
}
