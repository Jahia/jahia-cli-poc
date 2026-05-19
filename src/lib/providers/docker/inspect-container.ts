import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Inspects a container and returns its status.
 * Returns undefined if the container does not exist.
 */
export const inspectContainer = async (
  name: string,
): Promise<{ running: boolean; health: string; id: string } | undefined> => {
  try {
    const { stdout } = await execFileAsync('docker', [
      'inspect',
      '--format',
      '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.Id}}',
      name,
    ]);
    const parts = stdout.trim().split('|');
    return {
      running: parts[0] === 'true',
      health: parts[1] ?? 'none',
      id: parts[2] ?? '',
    };
  } catch {
    return undefined;
  }
};
