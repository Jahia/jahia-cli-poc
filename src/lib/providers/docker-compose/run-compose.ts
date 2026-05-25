import { execFile, spawn } from 'node:child_process';
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

/**
 * Executes a `docker compose` command with streaming output.
 * Calls `onOutput` for each line of stdout/stderr as it arrives.
 */
export const runComposeStreaming = (params: {
  readonly composePath: string;
  readonly args: readonly string[];
  readonly cwd?: string | undefined;
  readonly onOutput?: (line: string) => void;
}): Promise<{ readonly stdout: string; readonly stderr: string }> => {
  const cwd = params.cwd ?? dirname(params.composePath);
  const fullArgs = ['compose', '-f', params.composePath, ...params.args];

  return new Promise((resolve, reject) => {
    const child = spawn('docker', fullArgs, { cwd });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdoutChunks.push(text);
      if (params.onOutput) {
        text.split('\n').filter((l) => l.trim() !== '').forEach((line) => params.onOutput?.(line));
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrChunks.push(text);
      if (params.onOutput) {
        text.split('\n').filter((l) => l.trim() !== '').forEach((line) => params.onOutput?.(line));
      }
    });

    child.on('close', (code) => {
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `docker compose exited with code ${String(code)}`));
      }
    });

    child.on('error', reject);
  });
};
