import { describe, test, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[], env?: Record<string, string>): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args], { env: { ...process.env, ...env } });

describe('environment stop command', () => {
  test('shows help text with --help', async () => {
    const { stdout } = await run(['environment', 'stop', '--help']);
    expect(stdout).toContain('Stop a running Jahia environment');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--state-dir');
  });
});
