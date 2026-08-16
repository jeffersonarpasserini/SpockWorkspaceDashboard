import type { ProjectIdentity } from "@/lib/types";
import type { ProjectCatalogStore } from "./catalog-repository";

export function createPersistedProjectDiscovery(catalog: Pick<ProjectCatalogStore, "listWorkspaceProjects">, workspaceSlug: string) {
  return async (workspaceRoot: string): Promise<ProjectIdentity[]> => {
    void workspaceRoot;
    const projects = await catalog.listWorkspaceProjects(workspaceSlug);
    return projects.map((project) => ({
      id: project.externalId,
      name: project.name,
      markers: [...project.markers]
    }));
  };
}
