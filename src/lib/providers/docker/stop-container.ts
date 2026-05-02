import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Stops a running Docker container by name or ID.
 */
export const stopContainer = async (name: string): Promise<void> => {
  await execFileAsync('docker', ['stop', name]);
};
