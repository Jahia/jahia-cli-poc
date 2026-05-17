import { access, copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import { isExcluded, DEFAULT_EXCLUSION_PATTERNS } from './exclusion-list.js';
import type { SyncedFileEntry, SyncLogger, SyncMissingFilesParams, SyncMissingFilesResult } from './types.js';

const toPortablePath = (pathValue: string): string => pathValue.split(sep).join('/');

const destinationFileExists = async (destinationPath: string): Promise<boolean> =>
  access(destinationPath)
    .then(() => true)
    .catch(() => false);

const sortEntriesByPath = (entries: readonly SyncedFileEntry[]): readonly SyncedFileEntry[] =>
  [...entries].sort((left, right) => left.path.localeCompare(right.path));

const noopLogger: SyncLogger = () => undefined;

const walkAndSync = async (params: {
  readonly sourceDir: string;
  readonly destinationDir: string;
  readonly sourceRoot: string;
  readonly exclusionPatterns: readonly string[];
  readonly logger: SyncLogger;
  readonly force: boolean;
  readonly managedPaths: ReadonlySet<string>;
}): Promise<readonly SyncedFileEntry[]> => {
  const entries = await readdir(params.sourceDir, { withFileTypes: true });
  const nestedResults = await Promise.all(
    entries.map(async (entry): Promise<readonly SyncedFileEntry[]> => {
      const sourcePath = join(params.sourceDir, entry.name);
      const destinationPath = join(params.destinationDir, entry.name);

      if (entry.isDirectory()) {
        await mkdir(destinationPath, { recursive: true });
        return walkAndSync({
          sourceDir: sourcePath,
          destinationDir: destinationPath,
          sourceRoot: params.sourceRoot,
          exclusionPatterns: params.exclusionPatterns,
          logger: params.logger,
          force: params.force,
          managedPaths: params.managedPaths,
        });
      }

      if (!entry.isFile()) {
        return [];
      }

      const relativePath = toPortablePath(relative(params.sourceRoot, sourcePath));

      if (isExcluded(relativePath, params.exclusionPatterns)) {
        const reason = 'excluded by policy';
        params.logger('ignored', relativePath, reason);
        return [{ path: relativePath, action: 'ignored', reason }];
      }

      if (await destinationFileExists(destinationPath)) {
        if (params.force && params.managedPaths.has(relativePath)) {
          await mkdir(dirname(destinationPath), { recursive: true });
          await copyFile(sourcePath, destinationPath);
          const reason = 'overwritten (managed by scaffolding)';
          params.logger('overwritten', relativePath, reason);
          return [{ path: relativePath, action: 'overwritten', reason }];
        }

        const reason = 'already exists locally';
        params.logger('kept', relativePath, reason);
        return [{ path: relativePath, action: 'kept', reason }];
      }

      await mkdir(dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
      const reason = 'imported from remote';
      params.logger('copied', relativePath, reason);

      return [{ path: relativePath, action: 'copied', reason }];
    }),
  );

  return nestedResults.flatMap((value) => value);
};

export const syncMissingFiles = async (params: SyncMissingFilesParams): Promise<SyncMissingFilesResult> => {
  const exclusionPatterns = params.exclusionPatterns ?? DEFAULT_EXCLUSION_PATTERNS;
  const logger = params.logger ?? noopLogger;
  const force = params.force ?? false;
  const managedPaths = params.managedPaths ?? new Set<string>();

  await mkdir(params.destinationDir, { recursive: true });
  const entries = sortEntriesByPath(
    await walkAndSync({
      sourceDir: params.sourceDir,
      destinationDir: params.destinationDir,
      sourceRoot: params.sourceDir,
      exclusionPatterns,
      logger,
      force,
      managedPaths,
    }),
  );

  return {
    entries,
    copied: entries.filter((entry) => entry.action === 'copied').map((entry) => entry.path),
    kept: entries.filter((entry) => entry.action === 'kept').map((entry) => entry.path),
    ignored: entries.filter((entry) => entry.action === 'ignored').map((entry) => entry.path),
    overwritten: entries.filter((entry) => entry.action === 'overwritten').map((entry) => entry.path),
  };
};
