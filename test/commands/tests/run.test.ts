import { beforeEach, describe, expect, test, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import {
  CONTAINER_STATE_PATH,
  formatRunStart,
  formatRunComplete,
} from '../../../src/lib/tests/format-run-output.js';
import { buildStateMountArgs } from '../../../src/lib/tests/build-state-mount-args.js';

const execFileAsync = promisify(execFile);
const CLI = resolve('bin/dev.js');

const run = async (args: readonly string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync('node', [CLI, ...args], { timeout: 15_000 });

const createStateDir = async (): Promise<string> => {
  const dir = resolve('.test-artifacts', `tests-run-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
};

describe('tests run pure functions', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('formatRunStart', () => {
    test('includes image, network, and container name', () => {
      const msg = formatRunStart('jahia-tests:1.0', 'jahia-cli-env-abc', 'my-container');
      expect(msg).toContain('jahia-tests:1.0');
      expect(msg).toContain('jahia-cli-env-abc');
      expect(msg).toContain('my-container');
      expect(msg).toContain('▶');
    });

    test('includes state mount info when provided', () => {
      const msg = formatRunStart('jahia-tests:1.0', 'net', 'ctr', {
        host: '/workspace/.jahia-cli/state.json',
        container: '/jahia-cli/state.json',
      });
      expect(msg).toContain('/workspace/.jahia-cli/state.json');
      expect(msg).toContain('/jahia-cli/state.json');
      expect(msg).toContain('read-only');
    });

    test('omits state line when stateMount is undefined', () => {
      const msg = formatRunStart('img:tag', 'net', 'ctr');
      expect(msg).not.toContain('State');
    });
  });

  describe('formatRunComplete', () => {
    test('shows success for exit code 0', () => {
      const msg = formatRunComplete('test-container', 0);
      expect(msg).toContain('✓');
      expect(msg).toContain('passed');
      expect(msg).toContain('test-container');
    });

    test('shows failure for non-zero exit code', () => {
      const msg = formatRunComplete('test-container', 1);
      expect(msg).toContain('✗');
      expect(msg).toContain('failed');
      expect(msg).toContain('exit code 1');
    });

    test('includes container name for inspection hint', () => {
      const msg = formatRunComplete('my-cypress', 0);
      expect(msg).toContain('my-cypress');
      expect(msg).toContain('kept for inspection');
    });
  });

  describe('buildStateMountArgs', () => {
    test('returns bind mount and env var when state file exists', async () => {
      const dir = await createStateDir();
      const statePath = join(dir, 'state.json');

      try {
        await writeFile(statePath, '{"version": 1}', 'utf-8');
        const result = await buildStateMountArgs(statePath);
        expect(result).toBeDefined();
        if (result === undefined) {
          return;
        }
        expect(result.bindMount.host).toBe(resolve(statePath));
        expect(result.bindMount.container).toBe(CONTAINER_STATE_PATH);
        expect(result.bindMount.readOnly).toBe(true);
        expect(result.envVar).toEqual(['JAHIA_CLI_STATE', CONTAINER_STATE_PATH]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test('returns undefined when state file does not exist', async () => {
      const dir = await createStateDir();

      try {
        const result = await buildStateMountArgs(join(dir, 'nonexistent.json'));
        expect(result).toBeUndefined();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test('container path is /jahia-cli/state.json', () => {
      expect(CONTAINER_STATE_PATH).toBe('/jahia-cli/state.json');
    });
  });
});

describe('tests run integration', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['tests', 'run', '--help']);
    expect(stdout).toContain('tests run');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--state');
    expect(stdout).toContain('--env');
    expect(stdout).toContain('--service');
    expect(stdout).not.toContain('--tag');
  });
});
