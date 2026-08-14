import { constants } from "node:fs";
import { open, readdir, type FileHandle } from "node:fs/promises";

const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const CHANGE_KEY = /^[a-z0-9][a-z0-9-]*$/;

export interface ActiveChangeCatalog {
  keys: readonly string[];
  truncated: boolean;
}

export async function listActiveOpenSpecChanges(projectPath: string, limit: number): Promise<ActiveChangeCatalog> {
  if (process.platform !== "linux") throw new Error("Secure OpenSpec reads require Linux");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) throw new Error("Invalid OpenSpec change limit");
  const handles: FileHandle[] = [];
  try {
    const project = await openDirectory(projectPath); handles.push(project);
    const openspec = await openDirectoryAt(project, "openspec"); handles.push(openspec);
    const changes = await openDirectoryAt(openspec, "changes"); handles.push(changes);
    const entries = (await readdir(`/proc/self/fd/${changes.fd}`, { withFileTypes: true }))
      .filter((entry) => entry.name !== "archive" && !entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !CHANGE_KEY.test(entry.name)) throw new Error("Unsafe OpenSpec change entry");
    }
    return { keys: entries.slice(0, limit).map((entry) => entry.name), truncated: entries.length > limit };
  } finally {
    await Promise.allSettled(handles.reverse().map((handle) => handle.close()));
  }
}

async function openDirectory(target: string): Promise<FileHandle> {
  const handle = await open(target, DIRECTORY_FLAGS);
  const metadata = await handle.stat();
  if (!metadata.isDirectory()) {
    await handle.close();
    throw new Error("Unsafe OpenSpec directory");
  }
  return handle;
}

function openDirectoryAt(parent: FileHandle, child: string): Promise<FileHandle> {
  return openDirectory(`/proc/self/fd/${parent.fd}/${child}`);
}
