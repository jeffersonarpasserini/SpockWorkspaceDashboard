import { readDashboardConfig, defaultBoardSlug } from "./config";
import { readGitEvidence } from "./git";
import { mergeBoardTasks, readHermesEvidence } from "./kanban";
import { readOpenSpecEvidence } from "./openspec";
import { deriveProjectStatus } from "./status";
import { discoverProjects, resolveProjectPath } from "./workspace";
import type { GitEvidence, HermesEvidence, OpenSpecEvidence, ProjectDetail, ProjectIdentity, ProjectSummary } from "./types";

interface DashboardDependencies {
  workspaceRoot: string;
  boardMap: Record<string, string>;
  hermesBin: string;
  discover: (root: string) => Promise<ProjectIdentity[]>;
  resolve: (root: string, id: string) => Promise<string>;
  readGit: (projectPath: string) => Promise<GitEvidence>;
  readOpenSpec: (projectPath: string) => Promise<OpenSpecEvidence>;
  readHermes: (board: string, hermesBin: string) => Promise<HermesEvidence>;
}

function summarize(identity: ProjectIdentity, git: GitEvidence, openspec: OpenSpecEvidence, hermes: HermesEvidence, observedAt: string): ProjectSummary {
  const running = hermes.tasks.filter((task) => task.status === "running").length;
  const blocked = hermes.tasks.filter((task) => task.status === "blocked").length;
  return {
    ...identity,
    git,
    openspec: {
      availability: openspec.availability,
      checked: openspec.checked,
      unchecked: openspec.unchecked,
      changes: openspec.changes,
      message: openspec.message
    },
    hermes: { availability: hermes.availability, board: hermes.board, running, blocked, message: hermes.message },
    status: deriveProjectStatus({
      checked: openspec.checked,
      unchecked: openspec.unchecked,
      hermesStatuses: hermes.tasks.map((task) => task.status),
      gitAvailable: git.availability === "available",
      openspecAvailable: openspec.availability === "available",
      hermesAvailable: hermes.availability === "available"
    }),
    observedAt
  };
}

export function createDashboardService(deps: DashboardDependencies) {
  async function load(identity: ProjectIdentity): Promise<ProjectDetail> {
    const projectPath = await deps.resolve(deps.workspaceRoot, identity.id);
    const board = deps.boardMap[identity.name] ?? defaultBoardSlug(identity.name);
    const [git, openspec, hermes] = await Promise.all([
      deps.readGit(projectPath),
      deps.readOpenSpec(projectPath),
      deps.readHermes(board, deps.hermesBin)
    ]);
    const observedAt = new Date().toISOString();
    return { ...summarize(identity, git, openspec, hermes, observedAt), tasks: mergeBoardTasks(hermes.tasks, openspec.tasks) };
  }

  return {
    async listProjects(): Promise<ProjectSummary[]> {
      const identities = await deps.discover(deps.workspaceRoot);
      const details = await Promise.all(identities.map(load));
      return details.map(({ tasks: observedTasks, ...summary }) => {
        void observedTasks;
        return summary;
      });
    },
    async getProject(projectId: string): Promise<ProjectDetail> {
      const identity = (await deps.discover(deps.workspaceRoot)).find((project) => project.id === projectId);
      if (!identity) throw new Error("Unknown project identifier");
      return load(identity);
    }
  };
}

export function createDefaultDashboardService() {
  const config = readDashboardConfig();
  return createDashboardService({
    workspaceRoot: config.workspaceRoot,
    boardMap: config.boardMap,
    hermesBin: config.hermesBin,
    discover: discoverProjects,
    resolve: resolveProjectPath,
    readGit: readGitEvidence,
    readOpenSpec: readOpenSpecEvidence,
    readHermes: readHermesEvidence
  });
}
