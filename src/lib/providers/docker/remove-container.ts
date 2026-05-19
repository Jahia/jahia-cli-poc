import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Removes a container forcefully.
 * Ignores errors if the container does not exist.
 */
export const removeContainer = async (name: string): Promise<void> => {
  try {
    await execFileAsync('docker', ['rm', '-f', name]);
  } catch {
    // Container may not exist, that's fine
  }
};
