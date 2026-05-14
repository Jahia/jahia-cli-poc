import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

import {
  resolveVersion,
  formatBuildSuccess,
  formatBuildFailure,
} from '../../../src/commands/tests/build.js';

const execFileAsync = promisify(execFile);
const CLI = resolve('bin/dev.js');

const run = async (args: readonly string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync('node', [CLI, ...args], { timeout: 15_000 });

describe('tests build pure functions', () => {
  describe('resolveVersion', () => {
    test('returns config version when provided', () => {
      expect(resolveVersion('1.2.3')).toBe('1.2.3');
    });

    test('returns latest when undefined', () => {
      expect(resolveVersion(undefined)).toBe('latest');
    });
  });

  describe('formatBuildSuccess', () => {
    test('includes tag and dockerfile', () => {
      const msg = formatBuildSuccess('jahia-tests:1.0', 'docker/Dockerfile.local');
      expect(msg).toContain('jahia-tests:1.0');
      expect(msg).toContain('docker/Dockerfile.local');
      expect(msg).toContain('✓');
    });
  });

  describe('formatBuildFailure', () => {
    test('includes error message', () => {
      const msg = formatBuildFailure('buildx not found');
      expect(msg).toContain('buildx not found');
      expect(msg).toContain('✗');
    });
  });
});

describe('tests build integration', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['tests', 'build', '--help']);
    expect(stdout).toContain('tests build');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--dockerfile');
    expect(stdout).toContain('--tag');
    expect(stdout).toContain('--build-arg');
    expect(stdout).toContain('--platform');
    expect(stdout).toContain('--no-cache');
  });
});
