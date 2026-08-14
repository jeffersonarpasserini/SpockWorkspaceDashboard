import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, readdir, type FileHandle } from "node:fs/promises";
import { parseRepositoryBindings, parseSpecTasks, type ObservedSpecTask, type RepositoryBindings } from "./reconciliation";

const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const FILE_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;
const MAX_DOCUMENT_BYTES = 2_000_000;
const CHANGE_KEY = /^[a-z0-9][a-z0-9-]*$/;

export interface SnapshotDocument {
  kind: "proposal" | "design" | "tasks" | "spec";
  title: string;
  relativePath: string;
  content: string;
  contentHash: string;
}

export interface SnapshotScenario {
  externalRef: string;
  title: string;
  body: string;
  ordinal: number;
}

export interface SnapshotRequirement {
  capability: string;
  externalRef: string;
  title: string;
  body: string;
  ordinal: number;
  scenarios: readonly SnapshotScenario[];
}

export interface OpenSpecChangeSnapshot {
  changeKey: string;
  title: string;
  sourceRevision: string;
  documents: readonly SnapshotDocument[];
  requirements: readonly SnapshotRequirement[];
  tasks: readonly ObservedSpecTask[];
  bindings?: RepositoryBindings;
}

export function parseCapabilitySpec(markdown: string, capability: string): readonly SnapshotRequirement[] {
  const requirementMatches = [...markdown.matchAll(/^### Requirement:\s*(.+?)\s*$/gm)];
  return requirementMatches.map((match, requirementOrdinal) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = requirementMatches[requirementOrdinal + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end).trim();
    const scenarioMatches = [...section.matchAll(/^#### Scenario:\s*(.+?)\s*$/gm)];
    const firstScenario = scenarioMatches[0]?.index ?? section.length;
    return {
      capability,
      externalRef: `${capability}:R${requirementOrdinal + 1}`,
      title: match[1],
      body: section.slice(0, firstScenario).trim(),
      ordinal: requirementOrdinal,
      scenarios: scenarioMatches.map((scenario, scenarioOrdinal) => {
        const scenarioStart = (scenario.index ?? 0) + scenario[0].length;
        const scenarioEnd = scenarioMatches[scenarioOrdinal + 1]?.index ?? section.length;
        return {
          externalRef: `${capability}:R${requirementOrdinal + 1}:S${scenarioOrdinal + 1}`,
          title: scenario[1],
          body: section.slice(scenarioStart, scenarioEnd).trim(),
          ordinal: scenarioOrdinal
        };
      })
    };
  });
}

export async function readOpenSpecChangeSnapshot(projectPath: string, changeKey: string): Promise<OpenSpecChangeSnapshot> {
  if (process.platform !== "linux") throw new Error("Secure OpenSpec reads require Linux");
  if (!CHANGE_KEY.test(changeKey)) throw new Error("Invalid OpenSpec change key");

  const handles: FileHandle[] = [];
  try {
    const project = await openDirectory(projectPath); handles.push(project);
    const openspec = await openDirectoryAt(project, "openspec"); handles.push(openspec);
    const changes = await openDirectoryAt(openspec, "changes"); handles.push(changes);
    const change = await openDirectoryAt(changes, changeKey); handles.push(change);
    const documents: SnapshotDocument[] = [];

    const proposal = await readDocument(change, "proposal.md", "proposal", `openspec/changes/${changeKey}/proposal.md`);
    const tasksDocument = await readDocument(change, "tasks.md", "tasks", `openspec/changes/${changeKey}/tasks.md`);
    documents.push(proposal, tasksDocument);
    const design = await readOptionalDocument(change, "design.md", "design", `openspec/changes/${changeKey}/design.md`);
    if (design) documents.push(design);

    const requirements: SnapshotRequirement[] = [];
    const specs = await openDirectoryAt(change, "specs"); handles.push(specs);
    const capabilities = (await readdir(descriptorPath(specs), { withFileTypes: true }))
      .filter((entry) => !entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of capabilities) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !CHANGE_KEY.test(entry.name)) throw new Error("Unsafe OpenSpec capability");
      const capability = await openDirectoryAt(specs, entry.name); handles.push(capability);
      const document = await readDocument(capability, "spec.md", "spec", `openspec/changes/${changeKey}/specs/${entry.name}/spec.md`);
      documents.push(document);
      requirements.push(...parseCapabilitySpec(document.content, entry.name));
    }

    const bindings = await readBindings(project);
    const sourceRevision = createHash("sha256")
      .update(documents.map((document) => `${document.relativePath}\0${document.contentHash}`).sort().join("\0"))
      .digest("hex");
    return {
      changeKey,
      title: proposal.title.replace(/^Change:\s*/i, ""),
      sourceRevision,
      documents,
      requirements,
      tasks: parseSpecTasks(tasksDocument.content, changeKey),
      bindings
    };
  } finally {
    await Promise.allSettled(handles.reverse().map((handle) => handle.close()));
  }
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

function openDirectoryAt(parent: FileHandle, child: string): Promise<FileHandle> {
  return openDirectory(descriptorPath(parent, child));
}

async function readDocument(parent: FileHandle, name: string, kind: SnapshotDocument["kind"], relativePath: string): Promise<SnapshotDocument> {
  const handle = await open(descriptorPath(parent, name), FILE_FLAGS);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > MAX_DOCUMENT_BYTES) throw new Error("Unsafe OpenSpec document");
    const content = await handle.readFile({ encoding: "utf8" });
    const title = content.match(/^#\s+(.+?)\s*$/m)?.[1] ?? name;
    return { kind, title, relativePath, content, contentHash: createHash("sha256").update(content).digest("hex") };
  } finally {
    await handle.close();
  }
}

async function readOptionalDocument(parent: FileHandle, name: string, kind: SnapshotDocument["kind"], relativePath: string): Promise<SnapshotDocument | undefined> {
  try {
    return await readDocument(parent, name, kind, relativePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readBindings(project: FileHandle): Promise<RepositoryBindings | undefined> {
  let directory: FileHandle | undefined;
  let file: FileHandle | undefined;
  try {
    directory = await openDirectoryAt(project, ".spock");
    file = await open(descriptorPath(directory, "bindings.json"), FILE_FLAGS);
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > MAX_DOCUMENT_BYTES) throw new Error("Unsafe OpenSpec bindings");
    return parseRepositoryBindings(JSON.parse(await file.readFile({ encoding: "utf8" })));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  } finally {
    await file?.close();
    await directory?.close();
  }
}
