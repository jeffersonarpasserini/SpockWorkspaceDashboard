import { dashboardBaselineSchema } from "../control-plane/baseline-fixtures";

export interface MigratedProjectObservation {
  project: {
    externalId: string;
    name: string;
    markers: readonly string[];
  };
  observation: {
    observedAt: string;
    status: string;
    gitRevision?: string;
    gitDirty?: boolean;
    sourceAvailability: {
      git: string;
      openspec: string;
      hermes: string;
    };
  };
  tasks: readonly {
    externalId: string;
    title: string;
    observedStatus: string;
    source: string;
    observedAt: string;
  }[];
  /** A projection has no transition history; migration must not manufacture one. */
  historicalTransitions: readonly never[];
  historicalRuns: readonly never[];
  historicalUsage: readonly never[];
  historicalEvidence: readonly never[];
  limitations: readonly string[];
}

export function rehearseDashboardMigration(input: unknown): Readonly<MigratedProjectObservation> {
  const fixture = dashboardBaselineSchema.parse(input);
  const projection = fixture.projection;
  return Object.freeze({
    project: Object.freeze({ externalId: projection.id, name: projection.name, markers: Object.freeze([...projection.markers]) }),
    observation: Object.freeze({
      observedAt: projection.observedAt,
      status: projection.status,
      gitRevision: projection.git.commit,
      gitDirty: projection.git.dirty,
      sourceAvailability: Object.freeze({
        git: projection.git.availability,
        openspec: projection.openspec.availability,
        hermes: projection.hermes.availability
      })
    }),
    tasks: Object.freeze(projection.tasks.map((task) => Object.freeze({
      externalId: task.id,
      title: task.title,
      observedStatus: task.status,
      source: task.source,
      observedAt: projection.observedAt
    }))),
    historicalTransitions: Object.freeze([]),
    historicalRuns: Object.freeze([]),
    historicalUsage: Object.freeze([]),
    historicalEvidence: Object.freeze([]),
    limitations: Object.freeze([...fixture.limitations, "Imported values are one observed snapshot, not lifecycle events."])
  });
}
