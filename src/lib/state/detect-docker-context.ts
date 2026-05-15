import { access } from 'node:fs/promises';

import type { NetworkMode } from './resolve-url-types.js';

/**
 * Pure decision function: given environment signal and filesystem signal,
 * determine the network mode.
 *
 * Priority: env var override > filesystem detection > default (host).
 */
export const resolveNetworkMode = (envOverride: string | undefined, dockerenvExists: boolean): NetworkMode => {
  if (envOverride === 'docker-network' || envOverride === 'host') {
    return envOverride;
  }

  return dockerenvExists ? 'docker-network' : 'host';
};

/**
 * Checks whether `/.dockerenv` exists on disk.
 */
const checkDockerenvExists = async (): Promise<boolean> => {
  try {
    await access('/.dockerenv');
    return true;
  } catch {
    return false;
  }
};

/**
 * Detects whether the CLI is running on the host or inside a Docker container.
 *
 * Detection order:
 *   1. `JAHIA_CLI_NETWORK_MODE` env var (`'host'` or `'docker-network'`) — authoritative override
 *   2. Presence of `/.dockerenv` file — best-effort autodetection
 *   3. Default: `'host'`
 */
export const detectDockerContext = async (): Promise<NetworkMode> => {
  const envOverride = process.env['JAHIA_CLI_NETWORK_MODE'];
  const dockerenvExists = await checkDockerenvExists();
  return resolveNetworkMode(envOverride, dockerenvExists);
};
