export interface ScaffoldingCloneResult {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly checkoutDir: string;
  readonly scaffoldingDir: string;
}

export interface SyncedFileEntry {
  readonly path: string;
  readonly action: 'copied' | 'kept';
}

export interface SyncMissingFilesResult {
  readonly entries: readonly SyncedFileEntry[];
  readonly copied: readonly string[];
  readonly kept: readonly string[];
}
