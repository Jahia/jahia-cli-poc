import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import type { ArtifactCopyResult } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Copies artifact paths from a container using `docker cp`.
 * Each artifact path is copied to a per-component subdirectory.
 * Errors are captured per-path — one failure does not block others.
 */
export const copyContainerArtifacts = async (params: {
  readonly containerId: string;
  readonly componentName: string;
  readonly artifactPaths: readonly string[];
  readonly outputDir: string;
}): Promise<readonly ArtifactCopyResult[]> => {
  if (params.artifactPaths.length === 0) {
    return [];
  }

  const componentDir = join(params.outputDir, params.componentName);
  await mkdir(componentDir, { recursive: true });

  const results = await params.artifactPaths.reduce(
    async (chainPromise, artifactPath) => {
      const chain = await chainPromise;
      const destName = basename(artifactPath);
      const destPath = join(componentDir, destName);

      try {
        // First try copying as directory contents (trailing '/.' avoids double-nesting).
        // If the path is a file, this will fail, so we fall back to a plain copy.
        try {
          await mkdir(destPath, { recursive: true });
          await execFileAsync('docker', [
            'cp',
            `${params.containerId}:${artifactPath}/.`,
            destPath,
          ]);
        } catch {
          await execFileAsync('docker', [
            'cp',
            `${params.containerId}:${artifactPath}`,
            destPath,
          ]);
        }
        return [...chain, { path: artifactPath, success: true }];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return [...chain, { path: artifactPath, success: false, error: message }];
      }
    },
    Promise.resolve([] as readonly ArtifactCopyResult[]),
  );

  return results;
};
