import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, readdir, type FileHandle } from "node:fs/promises";
import type { BoardTask, OpenSpecEvidence } from "./types";

const MAX_TASK_FILE_BYTES = 1_000_000;
const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const FILE_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;

function taskId(change: string, section: string, title: string): string {
  return `openspec:${createHash("sha1").update(`${change}\0${section}\0${title}`).digest("hex").slice(0, 16)}`;
}

export function parseTasksMarkdown(markdown: string, change: string): BoardTask[] {
  const tasks: BoardTask[] = [];
  let section = "Tasks";
  let fenced = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = line.match(/^#{2,6}\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1];
      continue;
    }
    const checkbox = line.match(/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (!checkbox) continue;
    const title = checkbox[2];
    tasks.push({
      id: taskId(change, section, title),
      title,
      status: checkbox[1].toLowerCase() === "x" ? "done" : "todo",
      source: "openspec",
      change,
      section
    });
  }
  return tasks;
}

function descriptorPath(parent: FileHandle, child?: string): string {
  return `/proc/self/fd/${parent.fd}${child ? `/${child}` : ""}`;
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

async function openDirectoryAt(parent: FileHandle, child: string): Promise<FileHandle> {
  return openDirectory(descriptorPath(parent, child));
}

async function readTasksAt(changeDirectory: FileHandle, change: string): Promise<BoardTask[]> {
  const tasksHandle = await open(descriptorPath(changeDirectory, "tasks.md"), FILE_FLAGS);
  try {
    const metadata = await tasksHandle.stat();
    if (!metadata.isFile() || metadata.size > MAX_TASK_FILE_BYTES) throw new Error("Unsafe OpenSpec task file");
    const markdown = await tasksHandle.readFile({ encoding: "utf8" });
    return parseTasksMarkdown(markdown, change);
  } finally {
    await tasksHandle.close();
  }
}

export async function readOpenSpecEvidence(projectPath: string): Promise<OpenSpecEvidence> {
  if (process.platform !== "linux") {
    return { availability: "unavailable", checked: 0, unchecked: 0, changes: 0, tasks: [], message: "Secure OpenSpec reads require Linux" };
  }

  let projectDirectory: FileHandle | undefined;
  let openspecDirectory: FileHandle | undefined;
  let changesDirectory: FileHandle | undefined;
  try {
    projectDirectory = await openDirectory(projectPath);
    openspecDirectory = await openDirectoryAt(projectDirectory, "openspec");
    changesDirectory = await openDirectoryAt(openspecDirectory, "changes");
    const changes = (await readdir(descriptorPath(changesDirectory), { withFileTypes: true }))
      .filter((entry) => entry.name !== "archive" && !entry.name.startsWith("."));

    const tasks: BoardTask[] = [];
    let incomplete = false;
    for (const entry of changes) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        incomplete = true;
        continue;
      }
      let changeDirectory: FileHandle | undefined;
      try {
        changeDirectory = await openDirectoryAt(changesDirectory, entry.name);
        tasks.push(...await readTasksAt(changeDirectory, entry.name));
      } catch {
        incomplete = true;
      } finally {
        await changeDirectory?.close();
      }
    }

    return {
      availability: incomplete ? "unavailable" : "available",
      checked: tasks.filter((task) => task.status === "done").length,
      unchecked: tasks.filter((task) => task.status !== "done").length,
      changes: changes.length,
      tasks,
      message: incomplete ? "OpenSpec evidence is incomplete" : undefined
    };
  } catch {
    return { availability: "unavailable", checked: 0, unchecked: 0, changes: 0, tasks: [], message: "OpenSpec not available" };
  } finally {
    await changesDirectory?.close();
    await openspecDirectory?.close();
    await projectDirectory?.close();
  }
}
