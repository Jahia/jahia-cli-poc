import { describe, test, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';

import { reconcileWithDocker } from '../../../src/lib/state/reconcile-with-docker.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: (fn: unknown): unknown => fn,
}));

const mockExecFile = vi.mocked(execFile) as unknown as ReturnType<typeof vi.fn>;

const baseEnv: PersistedEnvironment = {
  name: 'test-env',
  provider: 'docker',
  composePath: '/workspace/environment/docker-compose.yml',
  config: {
    name: 'test-env',
    provider: 'docker',
    composePath: '/workspace/environment/docker-compose.yml',
  },
  createdAt: '2026-05-02T10:00:00Z',
};

describe('reconcileWithDocker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('returns compose services with their live status', async () => {
    mockExecFile.mockResolvedValue({
      stdout: '{"Service":"jahia","State":"running"}\n{"Service":"pgsql","State":"exited"}\n',
      stderr: '',
    });

    const result = await reconcileWithDocker(baseEnv);

    expect(result).toEqual({
      name: 'test-env',
      provider: 'docker',
      composePath: '/workspace/environment/docker-compose.yml',
      services: [
        { name: 'jahia', status: 'running' },
        { name: 'pgsql', status: 'exited' },
      ],
    });
  });

  test('returns an empty services list when docker compose ps fails', async () => {
    mockExecFile.mockRejectedValue(new Error('compose failed'));

    const result = await reconcileWithDocker(baseEnv);

    expect(result).toEqual({
      name: 'test-env',
      provider: 'docker',
      composePath: '/workspace/environment/docker-compose.yml',
      services: [],
    });
  });
});
