import { describe, expect, test } from 'vitest';

import { buildRunArgs, containerName } from '../../../src/lib/providers/docker/container.js';
import { networkName } from '../../../src/lib/providers/docker/network.js';
import { volumeName } from '../../../src/lib/providers/docker/volume.js';

describe('Docker container helpers', () => {
  test('containerName generates scoped name', () => {
    expect(containerName('my-env', 'pgsql')).toBe('jahia-cli-my-env-pgsql');
  });

  test('buildRunArgs generates correct docker run arguments', () => {
    const args = buildRunArgs({
      envName: 'test-env',
      componentName: 'pgsql',
      image: 'postgres',
      tag: '16-alpine',
      networkName: 'jahia-cli-test-env',
      ports: [{ container: 5432, host: 5432 }],
      env: { POSTGRES_DB: 'jahia', POSTGRES_USER: 'jahia' },
      volumes: [{ name: 'pgsql-data', containerPath: '/var/lib/postgresql/data' }],
      networkAliases: ['pgsql', 'database'],
      healthcheck: {
        command: ['CMD-SHELL', 'pg_isready -U jahia'],
        intervalSeconds: 5,
        timeoutSeconds: 5,
        retries: 5,
        startPeriodSeconds: 10,
      },
    });

    expect(args).toContain('run');
    expect(args).toContain('-d');
    expect(args).toContain('--name');
    expect(args).toContain('jahia-cli-test-env-pgsql');
    expect(args).toContain('--network');
    expect(args).toContain('jahia-cli-test-env');
    expect(args).toContain('--network-alias');
    expect(args).toContain('pgsql');
    expect(args).toContain('database');
    expect(args).toContain('-p');
    expect(args).toContain('5432:5432/tcp');
    expect(args).toContain('-e');
    expect(args).toContain('POSTGRES_DB=jahia');
    expect(args).toContain('-v');
    expect(args).toContain('jahia-cli-test-env-pgsql-data:/var/lib/postgresql/data');
    expect(args).toContain('--health-cmd');
    expect(args).toContain('CMD-SHELL pg_isready -U jahia');
    expect(args).toContain('--health-interval');
    expect(args).toContain('5s');
    expect(args).toContain('postgres:16-alpine');
  });

  test('buildRunArgs without healthcheck omits health flags', () => {
    const args = buildRunArgs({
      envName: 'env',
      componentName: 'test',
      image: 'nginx',
      tag: 'latest',
      networkName: 'net',
      ports: [],
      env: {},
      volumes: [],
      networkAliases: [],
    });

    expect(args).not.toContain('--health-cmd');
    expect(args).toContain('nginx:latest');
  });
});

describe('Docker network helpers', () => {
  test('networkName generates scoped name', () => {
    expect(networkName('my-env')).toBe('jahia-cli-my-env');
  });
});

describe('Docker volume helpers', () => {
  test('volumeName generates scoped name', () => {
    expect(volumeName('my-env', 'pgsql-data')).toBe('jahia-cli-my-env-pgsql-data');
  });
});
