import { describe, test, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures this runs before vi.mock hoisting
const { mockExecFileAsync } = vi.hoisted(() => ({ mockExecFileAsync: vi.fn() }));

vi.mock('node:child_process', () => {
  const execFile = vi.fn();
  // Attach promisify.custom so node:util promisify delegates to our mock
  Object.defineProperty(execFile, Symbol.for('nodejs.util.promisify.custom'), {
    value: mockExecFileAsync,
    configurable: true,
    writable: true,
  });
  return { execFile };
});

import {
  createNetwork,
  removeNetwork,
  networkExists,
} from '../../../src/lib/providers/docker/network.js';
import {
  inspectContainer,
  removeContainer,
} from '../../../src/lib/providers/docker/container.js';
import {
  createVolume,
  removeVolume,
} from '../../../src/lib/providers/docker/volume.js';
import { startContainer } from '../../../src/lib/providers/docker/start-container.js';
import { stopContainer } from '../../../src/lib/providers/docker/stop-container.js';
import { getContainerLogs } from '../../../src/lib/providers/docker/get-container-logs.js';

beforeEach(() => {
  mockExecFileAsync.mockReset();
});

describe('createNetwork', () => {
  test('creates a network and returns its name', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    const result = await createNetwork('my-env');
    expect(result).toBe('jahia-cli-my-env');
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'docker',
      ['network', 'create', '--driver', 'bridge', 'jahia-cli-my-env'],
    );
  });
});

describe('removeNetwork', () => {
  test('removes the network for an environment', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    await removeNetwork('my-env');
    expect(mockExecFileAsync).toHaveBeenCalledWith('docker', ['network', 'rm', 'jahia-cli-my-env']);
  });
});

describe('networkExists', () => {
  test('returns true when network exists', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '[]', stderr: '' });
    const result = await networkExists('my-env');
    expect(result).toBe(true);
  });

  test('returns false when docker inspect throws', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('No such network'));
    const result = await networkExists('my-env');
    expect(result).toBe(false);
  });
});

describe('inspectContainer', () => {
  test('returns running=true for a running container', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'true|healthy|abc123\n', stderr: '' });
    const result = await inspectContainer('jahia-cli-my-env-pgsql');
    expect(result).toEqual({ running: true, health: 'healthy', id: 'abc123' });
  });

  test('returns running=false for a stopped container', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'false|none|def456\n', stderr: '' });
    const result = await inspectContainer('jahia-cli-my-env-pgsql');
    expect(result).toEqual({ running: false, health: 'none', id: 'def456' });
  });

  test('returns undefined when container does not exist', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('No such container'));
    const result = await inspectContainer('jahia-cli-my-env-pgsql');
    expect(result).toBeUndefined();
  });
});

describe('removeContainer', () => {
  test('removes a container by name', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    await removeContainer('jahia-cli-my-env-pgsql');
    expect(mockExecFileAsync).toHaveBeenCalledWith('docker', ['rm', '-f', 'jahia-cli-my-env-pgsql']);
  });

  test('silently ignores errors (container may not exist)', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('No such container'));
    await expect(removeContainer('jahia-cli-my-env-pgsql')).resolves.toBeUndefined();
  });
});

describe('createVolume', () => {
  test('creates a volume and returns its name', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    const result = await createVolume('my-env', 'pgsql-data');
    expect(result).toBe('jahia-cli-my-env-pgsql-data');
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'docker',
      ['volume', 'create', 'jahia-cli-my-env-pgsql-data'],
    );
  });
});

describe('removeVolume', () => {
  test('removes a volume by environment and base name', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    await removeVolume('my-env', 'pgsql-data');
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'docker',
      ['volume', 'rm', '-f', 'jahia-cli-my-env-pgsql-data'],
    );
  });
});

describe('startContainer', () => {
  test('starts a container by name', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    await startContainer('jahia-cli-my-env-pgsql');
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'docker',
      ['start', 'jahia-cli-my-env-pgsql'],
    );
  });
});

describe('stopContainer', () => {
  test('stops a container by name', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    await stopContainer('jahia-cli-my-env-pgsql');
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'docker',
      ['stop', 'jahia-cli-my-env-pgsql'],
    );
  });
});

describe('getContainerLogs', () => {
  test('returns combined stdout and stderr', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'log line 1\n', stderr: 'warn line\n' });
    const result = await getContainerLogs('jahia-cli-my-env-jahia');
    expect(result).toBe('log line 1\nwarn line\n');
  });

  test('passes custom tail count to docker logs', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    await getContainerLogs('jahia-cli-my-env-jahia', 50);
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'docker',
      ['logs', '--tail', '50', 'jahia-cli-my-env-jahia'],
    );
  });
});

import { runContainer } from '../../../src/lib/providers/docker/container.js';

describe('runContainer', () => {
  test('runs a container and returns the container ID', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'abc123def456\n', stderr: '' });
    const id = await runContainer({
      envName: 'my-env',
      componentName: 'pgsql',
      image: 'postgres',
      tag: '16-alpine',
      networkName: 'jahia-cli-my-env',
      ports: [{ container: 5432, host: 5432 }],
      env: { POSTGRES_DB: 'jahia' },
      volumes: [],
      networkAliases: ['pgsql'],
    });
    expect(id).toBe('abc123def456');
    expect(mockExecFileAsync).toHaveBeenCalledWith('docker', expect.arrayContaining(['run', '-d']));
  });
});
