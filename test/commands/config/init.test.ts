import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('config init command', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['config', 'init', '--help']);
    expect(stdout).toContain('Generate an initialized Jahia CLI configuration file');
    expect(stdout).toContain('--blank');
    expect(stdout).toContain('--output');
    expect(stdout).toContain('--state');
    expect(stdout).toContain('--force');
    expect(stdout).toContain('--json');
  });

  test('creates blank config file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'blank-config.yml');

    try {
      await run(['config', 'init', '--blank', '--output', outputFile]);
      const content = await readFile(outputFile, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;

      expect(parsed['provider']).toBe('docker');
      expect(parsed['name']).toMatch(/^env-[a-f0-9]{8}$/);
      expect(parsed['components']).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('creates config from state file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const stateFile = join(dir, 'state.json');
    const outputFile = join(dir, 'derived-config.yml');

    await writeFile(
      stateFile,
      JSON.stringify(
        {
          version: 1,
          environment: {
            name: 'my-env',
            provider: 'docker',
            network: 'jahia-cli-my-env',
            components: [],
            config: {
              name: 'my-env',
              provider: 'docker',
              components: [{ name: 'jahia' }, { name: 'pgsql' }],
            },
            createdAt: '2026-05-04T20:00:00Z',
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    try {
      await run(['config', 'init', '--state', stateFile, '--output', outputFile]);
      const content = await readFile(outputFile, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;
      const components = parsed['components'] as unknown[];

      expect(parsed['name']).toBe('my-env');
      expect(parsed['provider']).toBe('docker');
      expect(components).toEqual(['jahia', 'pgsql']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
