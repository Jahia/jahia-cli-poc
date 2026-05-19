import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { HealthcheckConfig, PortMapping, VolumeMount } from '../../components/types.js';
import type { LogDriverConfig } from './docker-types.js';
import { buildRunArgs } from './build-run-args.js';

const execFileAsync = promisify(execFile);

/**
 * Starts a container using `docker run`.
 * Returns the container ID.
 */
export const runContainer = async (params: {
  readonly envName: string;
  readonly componentName: string;
  readonly image: string;
  readonly tag: string;
  readonly networkName: string;
  readonly ports: readonly PortMapping[];
  readonly env: Readonly<Record<string, string>>;
  readonly volumes: readonly VolumeMount[];
  readonly networkAliases: readonly string[];
  readonly healthcheck?: HealthcheckConfig | undefined;
  readonly logConfig?: LogDriverConfig | undefined;
  readonly containerArgs?: readonly string[] | undefined;
}): Promise<string> => {
  const args = buildRunArgs(params);
  const { stdout } = await execFileAsync('docker', [...args]);
  return stdout.trim();
};
