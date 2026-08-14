import { readOpenSpecChangeSnapshot, type OpenSpecChangeSnapshot } from "./snapshot";
import type { OpenSpecImportResult, OpenSpecRepository } from "./repository";

export interface OpenSpecSnapshotReader {
  read(projectPath: string, changeKey: string): Promise<OpenSpecChangeSnapshot>;
}

export class OpenSpecSyncService {
  constructor(
    private readonly repository: Pick<OpenSpecRepository, "importChange" | "recordReadFailure">,
    private readonly reader: OpenSpecSnapshotReader = { read: readOpenSpecChangeSnapshot }
  ) {}

  async synchronize(input: {
    projectId: string;
    sourceId: string;
    projectPath: string;
    changeKey: string;
    observedAt?: Date;
  }): Promise<OpenSpecImportResult> {
    const observedAt = input.observedAt ?? new Date();
    try {
      const snapshot = await this.reader.read(input.projectPath, input.changeKey);
      return await this.repository.importChange(input.projectId, input.sourceId, snapshot, observedAt);
    } catch (error) {
      await this.repository.recordReadFailure(input.sourceId, observedAt, error instanceof Error ? error.name : "OpenSpecReadError");
      throw new Error("OpenSpec source unavailable", { cause: error });
    }
  }
}
