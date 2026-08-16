export interface PortfolioOverviewProps {
  projects: number;
  activeWork: number;
  blockers: number;
  staleSources: number;
  budgetState: "ok" | "warning" | "critical" | "unavailable";
}

export function PortfolioOverview({ projects, activeWork, blockers, staleSources, budgetState }: PortfolioOverviewProps) {
  return (
    <section className="summary-strip portfolio-summary" aria-label="Portfolio status">
      <div><strong>{projects}</strong><span>Projects</span></div>
      <div><strong>{activeWork}</strong><span>Active work</span></div>
      <div><strong>{blockers}</strong><span>Blockers</span></div>
      <div><strong>{budgetState}</strong><span>Authoritative budget</span></div>
      <div><strong>{staleSources}</strong><span>Stale or unavailable sources</span></div>
    </section>
  );
}
