import { describe, expect, test } from 'vitest';

import { buildRunArgs, containerName } from '../../../src/lib/providers/docker/container.js';
import { networkName } from '../../../src/lib/providers/docker/network.js';
import { volumeName } from '../../../src/lib/providers/docker/volume.js';

describe('Docker container helpers', () => {
  test('containerName generates scoped name', () => {
    expect(containerName('my-env', 'jahia')).toBe('jahia-cli-my-env-jahia');
  });

  test('buildRunArgs generates correct docker run arguments', () => {
    const args = buildRunArgs({
      envName: 'test-env',
      componentName: 'jahia',
      image: 'jahia/jahia-ee',
      tag: '8.2.1.0',
      networkName: 'jahia-cli-test-env',
      ports: [{ container: 8080, host: 8080 }],
      env: { SUPER_USER_PASSWORD: 'root1234', MAX_RAM_PERCENTAGE: '80' },
      volumes: [{ name: 'jahia-data', containerPath: '/var/jahia/repository' }],
      networkAliases: ['jahia'],
      healthcheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/modules/healthcheck || exit 1'],
        intervalSeconds: 30,
        timeoutSeconds: 10,
        retries: 10,
        startPeriodSeconds: 120,
      },
    });

    expect(args).toContain('run');
    expect(args).toContain('-d');
    expect(args).toContain('--name');
    expect(args).toContain('jahia-cli-test-env-jahia');
    expect(args).toContain('--network');
    expect(args).toContain('jahia-cli-test-env');
    expect(args).toContain('--network-alias');
    expect(args).toContain('jahia');
    expect(args).toContain('-p');
    expect(args).toContain('8080:8080/tcp');
    expect(args).toContain('-e');
    expect(args).toContain('SUPER_USER_PASSWORD=root1234');
    expect(args).toContain('-v');
    expect(args).toContain('jahia-cli-test-env-jahia-data:/var/jahia/repository');
    expect(args).toContain('--health-cmd');
    expect(args).toContain('--health-interval');
    expect(args).toContain('30s');
    expect(args).toContain('jahia/jahia-ee:8.2.1.0');
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

  test('buildRunArgs includes log-driver when logConfig provided', () => {
    const args = buildRunArgs({
      envName: 'test-env',
      componentName: 'jahia',
      image: 'jahia/jahia-ee',
      tag: '8.2.1.0',
      networkName: 'jahia-cli-test-env',
      ports: [{ container: 8080, host: 8080 }],
      env: {},
      volumes: [],
      networkAliases: ['jahia'],
      logConfig: {
        driver: 'syslog',
        options: {
          'syslog-address': 'tcp://victorialogs:514',
          'tag': '{{.Name}}',
        },
      },
    });

    expect(args).toContain('--log-driver');
    expect(args).toContain('syslog');
    expect(args).toContain('--log-opt');
    expect(args).toContain('syslog-address=tcp://victorialogs:514');
    expect(args).toContain('tag={{.Name}}');
  });

  test('buildRunArgs without logConfig omits log-driver flags', () => {
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

    expect(args).not.toContain('--log-driver');
    expect(args).not.toContain('--log-opt');
  });

  test('buildRunArgs includes bind mounts with --mount syntax', () => {
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
      bindMounts: [
        { host: '/host/state.json', container: '/jahia-cli/state.json', readOnly: true },
      ],
    });

    expect(args).toContain('--mount');
    const mountIdx = args.indexOf('--mount');
    const mountArg = args[mountIdx + 1];
    expect(mountArg).toContain('type=bind');
    expect(mountArg).toContain('source=/host/state.json');
    expect(mountArg).toContain('target=/jahia-cli/state.json');
    expect(mountArg).toContain('readonly');
  });

  test('buildRunArgs bind mount without readOnly omits readonly flag', () => {
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
      bindMounts: [
        { host: '/tmp/file', container: '/app/file' },
      ],
    });

    const mountIdx = args.indexOf('--mount');
    const mountArg = args[mountIdx + 1];
    expect(mountArg).not.toContain('readonly');
  });

  test('buildRunArgs without bindMounts omits --mount', () => {
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

    expect(args).not.toContain('--mount');
  });
});

describe('Docker network helpers', () => {
  test('networkName generates scoped name', () => {
    expect(networkName('my-env')).toBe('jahia-cli-my-env');
  });
});

describe('Docker volume helpers', () => {
  test('volumeName generates scoped name', () => {
    expect(volumeName('my-env', 'jahia-data')).toBe('jahia-cli-my-env-jahia-data');
  });
});
