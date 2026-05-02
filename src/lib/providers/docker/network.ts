import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Generates the network name for an environment.
 */
export const networkName = (envName: string): string => `jahia-cli-${envName}`;

/**
 * Creates a Docker bridge network for the environment.
 */
export const createNetwork = async (envName: string): Promise<string> => {
  const name = networkName(envName);
  await execFileAsync('docker', ['network', 'create', '--driver', 'bridge', name]);
  return name;
};

/**
 * Removes a Docker network by environment name.
 */
export const removeNetwork = async (envName: string): Promise<void> => {
  const name = networkName(envName);
  await execFileAsync('docker', ['network', 'rm', name]);
};

/**
 * Checks if a Docker network exists for the environment.
 */
export const networkExists = async (envName: string): Promise<boolean> => {
  const name = networkName(envName);
  try {
    await execFileAsync('docker', ['network', 'inspect', name]);
    return true;
  } catch {
    return false;
  }
};
