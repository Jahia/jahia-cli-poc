import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Pulls a Docker image. Runs `docker pull` so the image is cached locally
 * before `docker run`. This avoids a silent wait during container creation
 * when the image isn't in the local cache.
 */
export const pullImage = async (image: string, tag: string): Promise<void> => {
  await execFileAsync('docker', ['pull', `${image}:${tag}`]);
};
