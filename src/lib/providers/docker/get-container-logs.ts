import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Retrieves logs from a Docker container (snapshot mode).
 */
export const getContainerLogs = async (
  containerName: string,
  tail = 100,
): Promise<string> => {
  const { stdout, stderr } = await execFileAsync('docker', [
    'logs',
    '--tail',
    String(tail),
    containerName,
  ]);
  // Docker logs may output to stderr for some containers
  return stdout + stderr;
};
