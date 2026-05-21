import { execFile } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { collectAllArtifacts } from '../../../src/lib/artifacts/collect-all.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: (fn: unknown): unknown => fn,
}));

const mockExecFile = vi.mocked(execFile) as unknown as ReturnType<typeof vi.fn>;

const makeEnv = (): PersistedEnvironment => ({
  name: 'test-env',
  provider: 'docker',
  composePath: '/workspace/environment/docker-compose.yml',
  config: {
    name: 'test-env',
    provider: 'docker',
    composePath: '/workspace/environment/docker-compose.yml',
  },
  createdAt: '2026-05-02T10:00:00Z',
});

const createOutputDir = async (): Promise<string> => {
  const dir = resolve('.test-artifacts', `collect-all-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
};

describe('collectAllArtifacts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('collects logs for every compose service', async () => {
    const outputDir = await createOutputDir();

    mockExecFile
      .mockResolvedValueOnce({ stdout: 'jahia\npgsql\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'jahia log line\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'pgsql log line\n', stderr: '' });

    try {
      const progress: string[] = [];
      const result = await collectAllArtifacts({
        env: makeEnv(),
        outputDir,
        onProgress: (message: string): void => {
          progress.push(message);
        },
      });

      expect(result.envName).toBe('test-env');
      expect(result.components).toEqual([
        {
          componentName: 'jahia',
          containerId: 'jahia',
          logFile: 'jahia.log',
          logSource: 'docker',
          logError: undefined,
          artifacts: [],
        },
        {
          componentName: 'pgsql',
          containerId: 'pgsql',
          logFile: 'pgsql.log',
          logSource: 'docker',
          logError: undefined,
          artifacts: [],
        },
      ]);
      expect(progress).toEqual([
        'Collecting logs for jahia...',
        'Collecting logs for pgsql...',
      ]);
      expect(await readFile(join(outputDir, 'jahia.log'), 'utf-8')).toBe('jahia log line\n');
      expect(await readFile(join(outputDir, 'pgsql.log'), 'utf-8')).toBe('pgsql log line\n');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  test('isolates log collection failures per service', async () => {
    const outputDir = await createOutputDir();

    mockExecFile
      .mockResolvedValueOnce({ stdout: 'jahia\npgsql\n', stderr: '' })
      .mockRejectedValueOnce(new Error('logs failed'))
      .mockResolvedValueOnce({ stdout: 'pgsql log line\n', stderr: '' });

    try {
      const result = await collectAllArtifacts({
        env: makeEnv(),
        outputDir,
      });

      expect(result.components).toEqual([
        {
          componentName: 'jahia',
          containerId: 'jahia',
          logFile: undefined,
          logSource: undefined,
          logError: 'logs failed',
          artifacts: [],
        },
        {
          componentName: 'pgsql',
          containerId: 'pgsql',
          logFile: 'pgsql.log',
          logSource: 'docker',
          logError: undefined,
          artifacts: [],
        },
      ]);
      expect(await readFile(join(outputDir, 'pgsql.log'), 'utf-8')).toBe('pgsql log line\n');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
