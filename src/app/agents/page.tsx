import { APPROVED_AGENT_PROFILES } from "@/modules/control-plane/agent-catalog";

export default function AgentsPage() {
  return (
    <main>
      <section className="hero compact-hero">
        <p className="eyebrow">Approved catalog</p>
        <h1>Agents and current profile bindings</h1>
        <p>Roles remain stable while provider and model bindings are versioned observations. Dispatch is not enabled by this view.</p>
      </section>
      <section className="section-shell" aria-labelledby="agent-catalog-heading">
        <div className="section-heading"><div><p className="eyebrow">Engineering workspace</p><h2 id="agent-catalog-heading">{APPROVED_AGENT_PROFILES.length} canonical agents</h2></div></div>
        <div className="project-grid">
          {APPROVED_AGENT_PROFILES.map((agent) => (
            <article className="project-card" key={agent.key}>
              <div className="project-card-header"><div><p className="project-path">{agent.role}</p><h3>{agent.displayName}</h3></div><span className="status-pill status-running">approved</span></div>
              <p>{agent.responsibility}</p>
              <dl>
                <div><dt>Profile</dt><dd>{agent.externalProfile}</dd></div>
                <div><dt>Model</dt><dd>{agent.model}</dd></div>
                <div><dt>Billing</dt><dd>{agent.billingMode}</dd></div>
                <div><dt>Capabilities</dt><dd>{agent.capabilities.join(", ")}</dd></div>
                <div><dt>Outcomes / tokens / costs / evidence</dt><dd>Unavailable until observed run evidence is integrated</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
