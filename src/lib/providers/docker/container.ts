import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { HealthcheckConfig, PortMapping, VolumeMount } from '../../components/types.js';
import { volumeName } from './volume.js';

const execFileAsync = promisify(execFile);

/**
 * Generates a container name scoped to an environment.
 */
export const containerName = (envName: string, componentName: string): string =>
  `jahia-cli-${envName}-${componentName}`;

/**
 * Builds the `docker run` argument list for a container.
 * This is a pure function for easy testing.
 */
export const buildRunArgs = (params: {
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
}): readonly string[] => {
  const args: string[] = ['run', '-d', '--name', containerName(params.envName, params.componentName)];

  // Network
  args.push('--network', params.networkName);

  // Network aliases
  params.networkAliases.forEach((alias) => {
    args.push('--network-alias', alias);
  });

  // Ports
  params.ports.forEach((port) => {
    const proto = port.protocol ?? 'tcp';
    args.push('-p', `${String(port.host)}:${String(port.container)}/${proto}`);
  });

  // Environment variables
  Object.entries(params.env).forEach(([key, value]) => {
    args.push('-e', `${key}=${value}`);
  });

  // Volumes
  params.volumes.forEach((vol) => {
    const vName = volumeName(params.envName, vol.name);
    args.push('-v', `${vName}:${vol.containerPath}`);
  });

  // Healthcheck
  if (params.healthcheck) {
    const hc = params.healthcheck;
    args.push(
      '--health-cmd', hc.command.join(' '),
      '--health-interval', `${String(hc.intervalSeconds)}s`,
      '--health-timeout', `${String(hc.timeoutSeconds)}s`,
      '--health-retries', String(hc.retries),
      '--health-start-period', `${String(hc.startPeriodSeconds)}s`,
    );
  }

  // Image
  args.push(`${params.image}:${params.tag}`);

  return args;
};

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
}): Promise<string> => {
  const args = buildRunArgs(params);
  const { stdout } = await execFileAsync('docker', [...args]);
  return stdout.trim();
};

/**
 * Inspects a container and returns its status.
 */
export const inspectContainer = async (
  name: string,
): Promise<{ running: boolean; health: string; id: string } | undefined> => {
  try {
    const { stdout } = await execFileAsync('docker', [
      'inspect',
      '--format',
      '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.Id}}',
      name,
    ]);
    const parts = stdout.trim().split('|');
    return {
      running: parts[0] === 'true',
      health: parts[1] ?? 'none',
      id: parts[2] ?? '',
    };
  } catch {
    return undefined;
  }
};

/**
 * Stops and removes a container.
 */
export const removeContainer = async (name: string): Promise<void> => {
  try {
    await execFileAsync('docker', ['rm', '-f', name]);
  } catch {
    // Container may not exist, that's fine
  }
};
