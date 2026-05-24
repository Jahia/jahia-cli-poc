import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { PersistedEnvironment } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Reconciled service with live Docker Compose status.
 */
export interface ReconciledComponent {
  readonly name: string;
  readonly status: string;
}

/**
 * Reconciled environment with live Docker Compose status.
 */
export interface ReconciledEnvironment {
  readonly name: string;
  readonly provider: string;
  readonly composePath: string;
  readonly services: readonly ReconciledComponent[];
}

/**
 * Reconciles the persisted environment state with live Docker Compose service status.
 * Uses `docker compose ps` to get the actual state of services.
 */
export const reconcileWithDocker = async (
  environment: PersistedEnvironment,
): Promise<ReconciledEnvironment> => {
  const composePath = environment.composePath;

  try {
    const { stdout } = await execFileAsync('docker', [
      'compose',
      '-f',
      composePath,
      'ps',
      '--format',
      'json',
    ]);

    const services: readonly ReconciledComponent[] = stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const parsed = JSON.parse(line) as { Service?: string; State?: string };
        return {
          name: parsed.Service ?? 'unknown',
          status: parsed.State ?? 'unknown',
        };
      });

    return {
      name: environment.name,
      provider: environment.provider,
      composePath,
      services,
    };
  } catch {
    return {
      name: environment.name,
      provider: environment.provider,
      composePath,
      services: [],
    };
  }
};
