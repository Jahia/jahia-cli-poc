import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import yaml from 'js-yaml';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

const createConfigDir = async (): Promise<string> => {
  const dir = resolve('.test-artifacts', `config-init-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
};

describe('config init command', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['config', 'init', '--help']);
    expect(stdout).toContain('Generate an initialized Jahia CLI configuration file');
    expect(stdout).toContain('--output');
    expect(stdout).toContain('--force');
    expect(stdout).toContain('--json');
  });

  test('creates blank config file with nested structure', async () => {
    const dir = await createConfigDir();
    const outputFile = join(dir, 'config.yml');

    try {
      await run(['config', 'init', '--output', outputFile]);
      const content = await readFile(outputFile, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;
      const environment = parsed['environment'] as Record<string, unknown>;

      expect(environment['provider']).toBe('docker');
      expect(environment['name']).toMatch(/^env-[a-f0-9]{8}$/);
      expect(environment['composePath']).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
