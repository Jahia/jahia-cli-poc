import { describe, expect, test } from 'vitest';

import {
  extractHostname,
  extractPort,
  resolveComponentUrl,
} from '../../../src/lib/state/resolve-component-url.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

describe('extractPort', () => {
  test('always returns the fallback port in host mode', () => {
    expect(extractPort('host', 0)).toBe(8080);
  });

  test('always returns the fallback port in docker-network mode', () => {
    expect(extractPort('docker-network', 3)).toBe(8080);
  });
});

describe('extractHostname', () => {
  test('returns localhost in host mode', () => {
    expect(extractHostname('jahia', 'host')).toBe('localhost');
  });

  test('returns the service name in docker-network mode', () => {
    expect(extractHostname('jahia', 'docker-network')).toBe('jahia');
  });
});

describe('resolveComponentUrl', () => {
  test('returns the default fallback when env is undefined', () => {
    const result = resolveComponentUrl('jahia', undefined, 'host');
    expect(result).toEqual({
      url: 'http://localhost:8080',
      source: 'default',
      networkMode: 'host',
    });
  });

  test('ignores persisted environment details in compose mode', () => {
    const env: PersistedEnvironment = {
      name: 'test-env',
      provider: 'docker',
      composePath: '/workspace/environment/docker-compose.yml',
      config: {
        name: 'test-env',
        provider: 'docker',
        composePath: '/workspace/environment/docker-compose.yml',
      },
      createdAt: '2024-01-01',
    };

    const result = resolveComponentUrl('jahia', env, 'docker-network');
    expect(result).toEqual({
      url: 'http://jahia:8080',
      source: 'default',
      networkMode: 'docker-network',
    });
  });

  test('uses an explicit port override when provided', () => {
    const result = resolveComponentUrl('jahia', undefined, 'host', 9090);
    expect(result.url).toBe('http://localhost:9090');
    expect(result.source).toBe('default');
  });
});
