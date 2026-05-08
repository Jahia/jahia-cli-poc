import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('reconcileWithDocker', () => {
  const baseEnv: PersistedEnvironment = {
    name: 'test-env',
    provider: 'docker',
    network: 'jahia-cli-test-env',
    components: [
      { name: 'victorialogs', image: 'victoriametrics/victoria-logs', tag: 'v1.15.0-victorialogs', containerId: 'aaa111' },
      { name: 'jahia', image: 'jahia/jahia-ee', tag: '8.2.1.0', containerId: 'bbb222' },
    ],
    config: { name: 'test-env', provider: 'docker', components: [{ name: 'jahia' }] },
    createdAt: '2026-05-02T10:00:00Z',
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('marks running containers as running', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'true\n', stderr: '' });

    const result = await reconcileWithDocker(baseEnv);

    expect(result.components[0]?.liveStatus).toBe('running');
    expect(result.components[1]?.liveStatus).toBe('running');
  });

  test('marks stopped containers as stopped', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'false\n', stderr: '' });

    const result = await reconcileWithDocker(baseEnv);

    expect(result.components[0]?.liveStatus).toBe('stopped');
  });

  test('marks missing containers as missing', async () => {
    mockExecFile.mockRejectedValue(new Error('No such container'));

    const result = await reconcileWithDocker(baseEnv);

    expect(result.components[0]?.liveStatus).toBe('missing');
    expect(result.components[1]?.liveStatus).toBe('missing');
  });

  test('handles mixed statuses', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' })
      .mockRejectedValueOnce(new Error('No such container'));

    const result = await reconcileWithDocker(baseEnv);

    expect(result.components[0]?.liveStatus).toBe('running');
    expect(result.components[1]?.liveStatus).toBe('missing');
  });
});
