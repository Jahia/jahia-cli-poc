import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Resolves an assets path to a list of file paths.
 * If the path is a directory, returns all files in it recursively.
 * If the path is a file, returns it as a single-element array.
 */
export const resolveAssetPaths = async (assetsPath: string): Promise<readonly string[]> => {
  const resolved = resolve(assetsPath);
  const info = await stat(resolved);

  if (!info.isDirectory()) {
    return [resolved];
  }

  const entries = await readdir(resolved, { recursive: true });
  const filePaths = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(resolved, entry);
      const entryStat = await stat(fullPath);
      return entryStat.isFile() ? fullPath : undefined;
    }),
  );

  return filePaths.filter((p): p is string => p !== undefined);
};
