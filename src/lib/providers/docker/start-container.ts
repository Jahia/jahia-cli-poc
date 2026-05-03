import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Starts a stopped Docker container by name or ID.
 */
export const startContainer = async (name: string): Promise<void> => {
  await execFileAsync('docker', ['start', name]);
};
