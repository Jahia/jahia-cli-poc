import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { HealthcheckConfig, PortMapping, VolumeMount } from '../../components/types.js';
import { volumeName } from './volume.js';

/**
 * A host-to-container bind mount for Docker.
 * Uses `--mount type=bind` syntax for cross-platform safety (Windows paths contain colons).
 */
export interface BindMount {
  readonly host: string;
  readonly container: string;
  readonly readOnly?: boolean | undefined;
}

const execFileAsync = promisify(execFile);

/**
 * Configuration for Docker container log driver.
 */
export interface LogDriverConfig {
  readonly driver: string;
  readonly options: Readonly<Record<string, string>>;
}

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
  readonly logConfig?: LogDriverConfig | undefined;
  readonly containerArgs?: readonly string[] | undefined;
  /** Host-to-container bind mounts (e.g. for mounting the state file into the test container). */
  readonly bindMounts?: readonly BindMount[] | undefined;
  /** When false, the container runs in the foreground (no -d). Defaults to true. */
  readonly detached?: boolean | undefined;
}): readonly string[] => {
  const args: string[] = ['run'];

  if (params.detached !== false) {
    args.push('-d');
  }

  args.push('--name', containerName(params.envName, params.componentName));

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

  // Bind mounts — uses --mount syntax for cross-platform safety (Windows paths contain colons)
  if (params.bindMounts) {
    params.bindMounts.forEach((mount) => {
      const parts = [`type=bind`, `source=${mount.host}`, `target=${mount.container}`];
      if (mount.readOnly === true) {
        parts.push('readonly');
      }

      args.push('--mount', parts.join(','));
    });
  }

  // Healthcheck
  if (params.healthcheck) {
    const hc = params.healthcheck;
    // Docker's --health-cmd implies CMD-SHELL, so strip it if present
    const cmdParts = hc.command[0] === 'CMD-SHELL' ? hc.command.slice(1) : hc.command;
    args.push(
      '--health-cmd', cmdParts.join(' '),
      '--health-interval', `${String(hc.intervalSeconds)}s`,
      '--health-timeout', `${String(hc.timeoutSeconds)}s`,
      '--health-retries', String(hc.retries),
      '--health-start-period', `${String(hc.startPeriodSeconds)}s`,
    );
  }

  // Log driver
  if (params.logConfig) {
    args.push('--log-driver', params.logConfig.driver);
    Object.entries(params.logConfig.options).forEach(([key, value]) => {
      args.push('--log-opt', `${key}=${value}`);
    });
  }

  // Image
  args.push(`${params.image}:${params.tag}`);

  // Container arguments (appended after the image)
  if (params.containerArgs) {
    params.containerArgs.forEach((arg) => {
      args.push(arg);
    });
  }

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
  readonly logConfig?: LogDriverConfig | undefined;
  readonly containerArgs?: readonly string[] | undefined;
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
 * Stops a running container gracefully (SIGTERM then SIGKILL after timeout).
 * Ignores errors if the container is not running or does not exist.
 */
export const stopContainer = async (name: string): Promise<void> => {
  try {
    await execFileAsync('docker', ['stop', '-t', '10', name]);
  } catch {
    // Container may not be running or may not exist, that's fine
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
