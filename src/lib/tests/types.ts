export interface ScaffoldingCloneResult {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly checkoutDir: string;
  readonly scaffoldingDir: string;
}

export type SyncAction = 'copied' | 'kept' | 'ignored' | 'overwritten';

export interface SyncedFileEntry {
  readonly path: string;
  readonly action: SyncAction;
  readonly reason?: string | undefined;
}

export type SyncLogger = (action: SyncAction, relativePath: string, reason: string) => void;

export interface SyncMissingFilesParams {
  readonly sourceDir: string;
  readonly destinationDir: string;
  readonly exclusionPatterns?: readonly string[] | undefined;
  readonly logger?: SyncLogger | undefined;
  readonly force?: boolean | undefined;
  readonly managedPaths?: ReadonlySet<string> | undefined;
}

export interface SyncMissingFilesResult {
  readonly entries: readonly SyncedFileEntry[];
  readonly copied: readonly string[];
  readonly kept: readonly string[];
  readonly ignored: readonly string[];
  readonly overwritten: readonly string[];
}
