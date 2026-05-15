import { describe, expect, test } from 'vitest';

import {
  extractHostname,
  extractPort,
  resolveComponentUrl,
} from '../../../src/lib/state/resolve-component-url.js';
import type { ComponentEndpoints } from '../../../src/lib/state/types.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

const makeEndpoints = (
  aliases: readonly string[],
  ports: readonly { readonly container: number; readonly host: number }[],
): ComponentEndpoints => ({
  aliases,
  ports,
});

const makeEnv = (overrides?: {
  readonly components?: PersistedEnvironment['components'];
  readonly configComponents?: PersistedEnvironment['config']['components'];
}): PersistedEnvironment => ({
  name: 'test-env',
  provider: 'docker',
  network: 'test-net',
  components: overrides?.components ?? [],
  config: {
    name: 'test-env',
    provider: 'docker',
    components: overrides?.configComponents ?? [{ name: 'jahia' }],
  },
  createdAt: '2024-01-01',
});

describe('extractPort', () => {
  test('returns host port in host mode', () => {
    const endpoints = makeEndpoints(['jahia'], [{ container: 8080, host: 9090 }]);
    expect(extractPort(endpoints, 'host', 0)).toBe(9090);
  });

  test('returns container port in docker-network mode', () => {
    const endpoints = makeEndpoints(['jahia'], [{ container: 8080, host: 9090 }]);
    expect(extractPort(endpoints, 'docker-network', 0)).toBe(8080);
  });

  test('returns undefined when endpoints is undefined', () => {
    expect(extractPort(undefined, 'host', 0)).toBeUndefined();
  });

  test('returns undefined when portIndex is out of range', () => {
    const endpoints = makeEndpoints(['jahia'], [{ container: 8080, host: 9090 }]);
    expect(extractPort(endpoints, 'host', 5)).toBeUndefined();
  });

  test('selects correct port by index', () => {
    const endpoints = makeEndpoints(['jahia'], [
      { container: 8080, host: 9090 },
      { container: 8101, host: 8101 },
    ]);
    expect(extractPort(endpoints, 'host', 1)).toBe(8101);
    expect(extractPort(endpoints, 'docker-network', 1)).toBe(8101);
  });
});

describe('extractHostname', () => {
  test('returns "localhost" in host mode regardless of aliases', () => {
    const endpoints = makeEndpoints(['jahia', 'my-jahia'], []);
    expect(extractHostname(endpoints, 'host')).toBe('localhost');
  });

  test('returns first alias in docker-network mode', () => {
    const endpoints = makeEndpoints(['jahia', 'my-jahia'], []);
    expect(extractHostname(endpoints, 'docker-network')).toBe('jahia');
  });

  test('returns "localhost" in docker-network mode when no aliases', () => {
    const endpoints = makeEndpoints([], []);
    expect(extractHostname(endpoints, 'docker-network')).toBe('localhost');
  });

  test('returns "localhost" when endpoints is undefined', () => {
    expect(extractHostname(undefined, 'docker-network')).toBe('localhost');
  });
});

describe('resolveComponentUrl', () => {
  test('returns default fallback when env is undefined', () => {
    const result = resolveComponentUrl('jahia', undefined, 'host');
    expect(result).toEqual({
      url: 'http://localhost:8080',
      source: 'default',
      networkMode: 'host',
    });
  });

  test('resolves host URL from persisted endpoints', () => {
    const env = makeEnv({
      components: [
        {
          name: 'jahia',
          image: 'jahia/jahia-ee',
          tag: '8.2.1.0',
          containerId: 'abc123',
          endpoints: makeEndpoints(['jahia'], [{ container: 8080, host: 9090 }]),
        },
      ],
    });
    const result = resolveComponentUrl('jahia', env, 'host');
    expect(result.url).toBe('http://localhost:9090');
    expect(result.source).toBe('state');
    expect(result.networkMode).toBe('host');
  });

  test('resolves docker-network URL from persisted endpoints', () => {
    const env = makeEnv({
      components: [
        {
          name: 'jahia',
          image: 'jahia/jahia-ee',
          tag: '8.2.1.0',
          containerId: 'abc123',
          endpoints: makeEndpoints(['jahia'], [{ container: 8080, host: 9090 }]),
        },
      ],
    });
    const result = resolveComponentUrl('jahia', env, 'docker-network');
    expect(result.url).toBe('http://jahia:8080');
    expect(result.source).toBe('state');
    expect(result.networkMode).toBe('docker-network');
  });

  test('falls back to component definition when no endpoints', () => {
    const env = makeEnv({
      components: [
        {
          name: 'jahia',
          image: 'jahia/jahia-ee',
          tag: '8.2.1.0',
          containerId: 'abc123',
        },
      ],
    });
    const result = resolveComponentUrl('jahia', env, 'host');
    expect(result.url).toBe('http://localhost:8080');
    expect(result.source).toBe('default');
  });

  test('falls back to component definition for docker-network with no endpoints', () => {
    const env = makeEnv({
      components: [
        {
          name: 'jahia',
          image: 'jahia/jahia-ee',
          tag: '8.2.1.0',
          containerId: 'abc123',
        },
      ],
    });
    const result = resolveComponentUrl('jahia', env, 'docker-network');
    expect(result.url).toBe('http://jahia:8080');
    expect(result.source).toBe('default');
    expect(result.networkMode).toBe('docker-network');
  });

  test('uses config override ports when no persisted endpoints', () => {
    const env = makeEnv({
      components: [],
      configComponents: [
        {
          name: 'jahia',
          overrides: { ports: [{ container: 8080, host: 7070 }] },
        },
      ],
    });
    const result = resolveComponentUrl('jahia', env, 'host');
    expect(result.url).toBe('http://localhost:7070');
    expect(result.source).toBe('state');
  });

  test('returns fallback for unknown component with no definition', () => {
    const env = makeEnv({ components: [] });
    const result = resolveComponentUrl('nonexistent', env, 'host');
    expect(result.url).toBe('http://localhost:8080');
    expect(result.source).toBe('default');
  });

  test('uses component name as hostname in docker-network mode when aliases are empty', () => {
    const env = makeEnv({
      components: [
        {
          name: 'jahia',
          image: 'jahia/jahia-ee',
          tag: '8.2.1.0',
          containerId: 'abc123',
          endpoints: makeEndpoints([], [{ container: 8080, host: 32789 }]),
        },
      ],
    });
    const result = resolveComponentUrl('jahia', env, 'docker-network');
    expect(result.url).toBe('http://jahia:8080');
    expect(result.source).toBe('state');
    expect(result.networkMode).toBe('docker-network');
  });

  test('respects portIndex for multi-port components', () => {
    const env = makeEnv({
      components: [
        {
          name: 'jahia',
          image: 'jahia/jahia-ee',
          tag: '8.2.1.0',
          containerId: 'abc123',
          endpoints: makeEndpoints(['jahia'], [
            { container: 8080, host: 9090 },
            { container: 8101, host: 8101 },
          ]),
        },
      ],
    });
    const result = resolveComponentUrl('jahia', env, 'host', 1);
    expect(result.url).toBe('http://localhost:8101');
    expect(result.source).toBe('state');
  });
});
