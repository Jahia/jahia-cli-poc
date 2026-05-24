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

describe('environment create command (integration)', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['environment', 'create', '--help']);
    expect(stdout).toContain('Create a new Jahia environment using docker compose');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--force');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--state');
  });

  test('does not expose removed legacy flags', async () => {
    const { stdout } = await run(['environment', 'create', '--help']);
    expect(stdout).not.toContain('--component');
    expect(stdout).not.toContain('--name');
    expect(stdout).not.toContain('--provider');
    expect(stdout).not.toContain('--export-config');
  });
});
