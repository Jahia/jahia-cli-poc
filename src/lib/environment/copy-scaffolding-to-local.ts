import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Recursively copies a directory from source to destination.
 * Creates destination directories as needed.
 */
export const copyDir = async (source: string, destination: string): Promise<void> => {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source);

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = join(source, entry);
      const destPath = join(destination, entry);
      const entryStat = await stat(srcPath);

      if (entryStat.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }),
  );
};
