import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Lists container names matching the environment prefix.
 */
export const listEnvironmentContainers = async (envName: string): Promise<readonly string[]> => {
  const prefix = `jahia-cli-${envName}-`;
  try {
    const { stdout } = await execFileAsync('docker', [
      'ps',
      '-a',
      '--filter',
      `name=${prefix}`,
      '--format',
      '{{.Names}}',
    ]);
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * Lists volume names matching the environment prefix.
 */
export const listEnvironmentVolumes = async (envName: string): Promise<readonly string[]> => {
  const prefix = `jahia-cli-${envName}-`;
  try {
    const { stdout } = await execFileAsync('docker', [
      'volume',
      'ls',
      '--filter',
      `name=${prefix}`,
      '--format',
      '{{.Name}}',
    ]);
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
};
