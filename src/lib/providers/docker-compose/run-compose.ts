import { execFile } from 'node:child_process';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Executes a `docker compose` command against a specific compose file.
 * Uses the compose file's directory as the working directory.
 */
export const runCompose = async (params: {
  readonly composePath: string;
  readonly args: readonly string[];
  readonly cwd?: string | undefined;
}): Promise<{ readonly stdout: string; readonly stderr: string }> => {
  const cwd = params.cwd ?? dirname(params.composePath);
  const fullArgs = ['compose', '-f', params.composePath, ...params.args];

  const { stdout, stderr } = await execFileAsync('docker', [...fullArgs], { cwd });
  return { stdout, stderr };
};
