import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { ArtifactMapping } from '../components/types.js';
import type { ArtifactCopyResult } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Copies artifact paths from a container using `docker cp`.
 * Each artifact mapping specifies a source path inside the container and
 * a destination relative to the output directory.
 * Errors are captured per-path — one failure does not block others.
 */
export const copyContainerArtifacts = async (params: {
  readonly containerId: string;
  readonly artifactMappings: readonly ArtifactMapping[];
  readonly outputDir: string;
}): Promise<readonly ArtifactCopyResult[]> => {
  if (params.artifactMappings.length === 0) {
    return [];
  }

  const results = await params.artifactMappings.reduce(
    async (chainPromise, mapping) => {
      const chain = await chainPromise;
      const destPath = join(params.outputDir, mapping.destination);

      try {
        await mkdir(destPath, { recursive: true });
        // First try copying as directory contents (trailing '/.' avoids double-nesting).
        // If the path is a file, this will fail, so we fall back to a plain copy.
        try {
          await execFileAsync('docker', [
            'cp',
            `${params.containerId}:${mapping.source}/.`,
            destPath,
          ]);
        } catch {
          await execFileAsync('docker', [
            'cp',
            `${params.containerId}:${mapping.source}`,
            destPath,
          ]);
        }
        return [...chain, { path: mapping.source, destination: mapping.destination, success: true }];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return [...chain, { path: mapping.source, destination: mapping.destination, success: false, error: message }];
      }
    },
    Promise.resolve([] as readonly ArtifactCopyResult[]),
  );

  return results;
};
