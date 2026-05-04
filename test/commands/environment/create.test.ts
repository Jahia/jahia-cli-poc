import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildConfigFromFlags } from '../../../src/commands/environment/create.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('buildConfigFromFlags', () => {
  test('builds config with provided name and components', () => {
    const config = buildConfigFromFlags({
      name: 'my-env',
      provider: 'docker',
      components: ['jahia', 'pgsql'],
    });
    expect(config.name).toBe('my-env');
    expect(config.provider).toBe('docker');
    expect(config.components).toHaveLength(2);
    expect(config.components[0]?.name).toBe('jahia');
  });

  test('generates name when not provided', () => {
    const config = buildConfigFromFlags({
      name: undefined,
      provider: 'docker',
      components: ['pgsql'],
    });
    expect(config.name).toMatch(/^env-[a-f0-9]{8}$/);
  });
});

describe('environment create command (integration)', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['environment', 'create', '--help']);
    expect(stdout).toContain('Create a new Jahia environment');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--component');
    expect(stdout).toContain('--name');
    expect(stdout).toContain('--provider');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--state-dir');
  });
});
