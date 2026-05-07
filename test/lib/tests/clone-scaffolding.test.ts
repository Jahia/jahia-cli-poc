import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { mockExecFileAsync } = vi.hoisted(() => ({ mockExecFileAsync: vi.fn() }));

vi.mock('node:child_process', () => {
  const execFile = vi.fn();
  Object.defineProperty(execFile, Symbol.for('nodejs.util.promisify.custom'), {
    value: mockExecFileAsync,
    configurable: true,
    writable: true,
  });
  return { execFile };
});

import {
  buildCloneArgs,
  cloneScaffolding,
  DEFAULT_CYPRESS_REPOSITORY,
  parseLatestTagFromLsRemote,
  resolveLatestTag,
} from '../../../src/lib/tests/clone-scaffolding.js';

const tempDirRef: { current: string } = { current: '' };

beforeEach(async () => {
  tempDirRef.current = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
  mockExecFileAsync.mockReset();
});

afterEach(async () => {
  await rm(tempDirRef.current, { recursive: true, force: true });
});

describe('parseLatestTagFromLsRemote', () => {
  test('extracts latest tag from git ls-remote output', () => {
    const output = ['abc123\trefs/tags/v3.2.1', 'def456\trefs/tags/v3.2.0'].join('\n');

    expect(parseLatestTagFromLsRemote(output, DEFAULT_CYPRESS_REPOSITORY)).toBe('v3.2.1');
  });

  test('throws when no tags are present', () => {
    expect(() => parseLatestTagFromLsRemote('', DEFAULT_CYPRESS_REPOSITORY)).toThrow(
      'No tags found',
    );
  });
});

describe('resolveLatestTag', () => {
  test('queries git and resolves latest tag', async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: 'abc123\trefs/tags/v2.0.0\ndef456\trefs/tags/v1.9.0\n',
      stderr: '',
    });

    const tag = await resolveLatestTag(DEFAULT_CYPRESS_REPOSITORY);

    expect(tag).toBe('v2.0.0');
    expect(mockExecFileAsync).toHaveBeenCalledWith('git', [
      'ls-remote',
      '--tags',
      '--refs',
      '--sort=-v:refname',
      DEFAULT_CYPRESS_REPOSITORY,
    ]);
  });
});

describe('buildCloneArgs', () => {
  test('builds clone arguments with branch/tag and destination', () => {
    expect(
      buildCloneArgs({
        version: 'test-jahia-cli',
        repositoryUrl: DEFAULT_CYPRESS_REPOSITORY,
        checkoutDir: '/tmp/checkout',
      }),
    ).toEqual([
      'clone',
      '--depth',
      '1',
      '--branch',
      'test-jahia-cli',
      DEFAULT_CYPRESS_REPOSITORY,
      '/tmp/checkout',
    ]);
  });
});

describe('cloneScaffolding', () => {
  test('clones repository and returns resolved directories when scaffolding exists', async () => {
    mockExecFileAsync.mockImplementation(async (_command: string, args: readonly string[]) => {
      const checkoutDir = args.at(-1);
      await mkdir(join(checkoutDir ?? '', 'scaffolding'), { recursive: true });
      return { stdout: '', stderr: '' };
    });

    const result = await cloneScaffolding({
      version: 'test-jahia-cli',
      workDir: tempDirRef.current,
    });

    const expectedCheckoutDir = join(tempDirRef.current, 'jahia-cypress');
    expect(result.repositoryUrl).toBe(DEFAULT_CYPRESS_REPOSITORY);
    expect(result.checkoutDir).toBe(expectedCheckoutDir);
    expect(result.scaffoldingDir).toBe(join(expectedCheckoutDir, 'scaffolding'));
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'git',
      buildCloneArgs({
        version: 'test-jahia-cli',
        repositoryUrl: DEFAULT_CYPRESS_REPOSITORY,
        checkoutDir: expectedCheckoutDir,
      }),
      { cwd: tempDirRef.current },
    );
  });

  test('resolves latest tag when version is not provided', async () => {
    mockExecFileAsync.mockImplementation(async (_command: string, args: readonly string[]) => {
      if (args[0] === 'ls-remote') {
        return { stdout: 'abc123\trefs/tags/v9.0.0\n', stderr: '' };
      }

      const checkoutDir = args.at(-1);
      await mkdir(join(checkoutDir ?? '', 'scaffolding'), { recursive: true });
      return { stdout: '', stderr: '' };
    });

    const result = await cloneScaffolding({
      workDir: tempDirRef.current,
    });

    expect(result.version).toBe('v9.0.0');
    expect(mockExecFileAsync).toHaveBeenCalledWith('git', [
      'ls-remote',
      '--tags',
      '--refs',
      '--sort=-v:refname',
      DEFAULT_CYPRESS_REPOSITORY,
    ]);
  });

  test('throws when scaffolding directory does not exist after clone', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    await expect(
      cloneScaffolding({ version: 'test-jahia-cli', workDir: tempDirRef.current }),
    ).rejects.toThrow('Scaffolding directory not found');
  });

  test('propagates git clone errors', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('fatal: Remote branch does not exist'));
    await expect(
      cloneScaffolding({ version: 'missing', workDir: tempDirRef.current }),
    ).rejects.toThrow('Remote branch does not exist');
  });
});
