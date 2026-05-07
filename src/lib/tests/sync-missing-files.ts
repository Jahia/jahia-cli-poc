import { access, copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import type { SyncMissingFilesResult, SyncedFileEntry } from './types.js';

const toPortablePath = (pathValue: string): string => pathValue.split(sep).join('/');

const destinationFileExists = async (destinationPath: string): Promise<boolean> =>
  access(destinationPath)
    .then(() => true)
    .catch(() => false);

const sortEntriesByPath = (entries: readonly SyncedFileEntry[]): readonly SyncedFileEntry[] =>
  [...entries].sort((left, right) => left.path.localeCompare(right.path));

const walkAndSync = async (params: {
  readonly sourceDir: string;
  readonly destinationDir: string;
  readonly sourceRoot: string;
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
        });
      }

      if (!entry.isFile()) {
        return [];
      }

      const relativePath = toPortablePath(relative(params.sourceRoot, sourcePath));
      if (await destinationFileExists(destinationPath)) {
        return [{ path: relativePath, action: 'kept' }];
      }

      await mkdir(dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);

      return [{ path: relativePath, action: 'copied' }];
    }),
  );

  return nestedResults.flatMap((value) => value);
};

export const syncMissingFiles = async (params: {
  readonly sourceDir: string;
  readonly destinationDir: string;
}): Promise<SyncMissingFilesResult> => {
  await mkdir(params.destinationDir, { recursive: true });
  const entries = sortEntriesByPath(
    await walkAndSync({
      sourceDir: params.sourceDir,
      destinationDir: params.destinationDir,
      sourceRoot: params.sourceDir,
    }),
  );

  return {
    entries,
    copied: entries.filter((entry) => entry.action === 'copied').map((entry) => entry.path),
    kept: entries.filter((entry) => entry.action === 'kept').map((entry) => entry.path),
  };
};
