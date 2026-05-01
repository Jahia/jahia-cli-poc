import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Generates a volume name scoped to an environment.
 */
export const volumeName = (envName: string, volumeBaseName: string): string =>
  `jahia-cli-${envName}-${volumeBaseName}`;

/**
 * Creates a named Docker volume for a component within an environment.
 */
export const createVolume = async (envName: string, volumeBaseName: string): Promise<string> => {
  const name = volumeName(envName, volumeBaseName);
  await execFileAsync('docker', ['volume', 'create', name]);
  return name;
};

/**
 * Removes a named Docker volume.
 */
export const removeVolume = async (envName: string, volumeBaseName: string): Promise<void> => {
  const name = volumeName(envName, volumeBaseName);
  await execFileAsync('docker', ['volume', 'rm', '-f', name]);
};
