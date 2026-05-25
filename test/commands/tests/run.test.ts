import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

import {
  formatProfileRunStart,
  formatProfileRunComplete,
} from '../../../src/commands/tests/run.js';

const execFileAsync = promisify(execFile);
const CLI = resolve('bin/dev.js');

const run = async (args: readonly string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync('node', [CLI, ...args], { timeout: 15_000 });

describe('tests run pure functions', () => {
  describe('formatProfileRunStart', () => {
    test('includes profile and compose path', () => {
      const msg = formatProfileRunStart('tests', '/path/to/docker-compose.yml');
      expect(msg).toContain('tests');
      expect(msg).toContain('/path/to/docker-compose.yml');
      expect(msg).toContain('▶');
    });

    test('shows custom profile name', () => {
      const msg = formatProfileRunStart('integration', '/path/compose.yml');
      expect(msg).toContain('integration');
    });
  });

  describe('formatProfileRunComplete', () => {
    test('shows success for exit code 0', () => {
      const msg = formatProfileRunComplete('tests', 0);
      expect(msg).toContain('✓');
      expect(msg).toContain('passed');
      expect(msg).toContain('tests');
    });

    test('shows failure for non-zero exit code', () => {
      const msg = formatProfileRunComplete('tests', 1);
      expect(msg).toContain('✗');
      expect(msg).toContain('failed');
      expect(msg).toContain('exit code 1');
    });

    test('includes profile name', () => {
      const msg = formatProfileRunComplete('integration', 0);
      expect(msg).toContain('integration');
    });
  });
});

describe('tests run integration', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['tests', 'run', '--help']);
    expect(stdout).toContain('tests run');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--profile');
    expect(stdout).toContain('--state');
    expect(stdout).not.toContain('--service');
    expect(stdout).not.toContain('--env');
  });
});
