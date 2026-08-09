import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { ProjectIdentity } from "./types";

const MARKERS = [".git", "openspec", "package.json", "pom.xml", "pyproject.toml", "Cargo.toml", "AGENTS.md"];

function encodeProjectName(name: string): string {
  return Buffer.from(name, "utf8").toString("base64url");
}

function decodeProjectId(id: string): string {
  try {
    const value = Buffer.from(id, "base64url").toString("utf8");
    if (!value || encodeProjectName(value) !== id) throw new Error("non-canonical id");
    return value;
  } catch {
    throw new Error("Unknown project identifier");
  }
}

async function isWithin(root: string, candidate: string): Promise<boolean> {
  const [resolvedRoot, resolvedCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function discoverProjects(workspaceRoot: string): Promise<ProjectIdentity[]> {
  const root = await realpath(workspaceRoot);
  const entries = await readdir(root, { withFileTypes: true });
  const projects: ProjectIdentity[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const candidate = path.join(root, entry.name);
    if (!(await isWithin(root, candidate))) continue;

    const markers: string[] = [];
    for (const marker of MARKERS) {
      try {
        const markerStat = await lstat(path.join(candidate, marker));
        if (!markerStat.isSymbolicLink() && (markerStat.isFile() || markerStat.isDirectory())) markers.push(marker);
      } catch {
        // A missing marker is expected.
      }
    }
    if (markers.length > 0) projects.push({ id: encodeProjectName(entry.name), name: entry.name, markers });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export async function resolveProjectPath(workspaceRoot: string, projectId: string): Promise<string> {
  const name = decodeProjectId(projectId);
  const projects = await discoverProjects(workspaceRoot);
  if (!projects.some((project) => project.id === projectId && project.name === name)) {
    throw new Error("Unknown project identifier");
  }
  const candidate = path.join(await realpath(workspaceRoot), name);
  if (!(await isWithin(workspaceRoot, candidate))) throw new Error("Project path is outside workspace");
  return candidate;
}
