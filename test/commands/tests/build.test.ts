import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

import {
  resolveVersion,
  resolveImageName,
  formatBuildSuccess,
  formatBuildFailure,
} from '../../../src/commands/tests/build.js';

const execFileAsync = promisify(execFile);
const CLI = resolve('bin/dev.js');

const run = async (args: readonly string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync('node', [CLI, ...args], { timeout: 15_000 });

describe('tests build pure functions', () => {
  describe('resolveVersion', () => {
    test('returns container config tag when provided', () => {
      expect(resolveVersion({ tag: '2.0.0' }, '1.2.3')).toBe('2.0.0');
    });

    test('falls back to scaffolding version', () => {
      expect(resolveVersion(undefined, '1.2.3')).toBe('1.2.3');
    });

    test('falls back to latest when nothing provided', () => {
      expect(resolveVersion(undefined, undefined)).toBe('latest');
    });

    test('container tag takes priority over scaffolding version', () => {
      expect(resolveVersion({ tag: 'custom' }, 'scaffolding-ver')).toBe('custom');
    });
  });

  describe('resolveImageName', () => {
    test('returns container config image when provided', () => {
      expect(resolveImageName({ image: 'my-custom-image' })).toBe('my-custom-image');
    });

    test('returns default when undefined', () => {
      expect(resolveImageName(undefined)).toBe('jahia-tests');
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
    expect(stdout).toContain('--no-cache');
    expect(stdout).not.toContain('--tag');
    expect(stdout).not.toContain('--build-arg');
    expect(stdout).not.toContain('--platform');
    expect(stdout).not.toContain('--dockerfile');
  });
});
