import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('environment doctor command (integration)', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['environment', 'doctor', '--help']);
    expect(stdout).toContain('Check the health status');
    expect(stdout).toContain('--name');
    expect(stdout).toContain('--provider');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--state');
  });
});
