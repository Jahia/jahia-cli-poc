import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const toPortable = (pathValue: string): string => pathValue.split(sep).join('/');

/**
 * Recursively collects all file paths under a directory,
 * returning them as portable (forward-slash) paths relative to `baseDir`.
 *
 * Example: collectFilePaths('/project/environment', '/project')
 *   → ['environment/docker-compose.yml', 'environment/services/jahia.yml', ...]
 */
export const collectFilePaths = async (
  directory: string,
  baseDir: string,
): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectFilePaths(fullPath, baseDir);
      }
      if (entry.isFile()) {
        return [toPortable(relative(baseDir, fullPath))];
      }
      return [];
    }),
  );
  return nested.flat();
};
