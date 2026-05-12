import { describe, expect, test } from 'vitest';

import { getJahiaConnectionDefaults } from '../../../src/lib/state/get-jahia-connection-defaults.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

describe('getJahiaConnectionDefaults', () => {
  test('returns hardcoded defaults when env is undefined', () => {
    const result = getJahiaConnectionDefaults(undefined);
    expect(result).toEqual({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
    });
  });

  test('uses port from jahia component definition when no override', () => {
    const env: PersistedEnvironment = {
      name: 'test',
      provider: 'docker',
      network: 'test-net',
      components: [],
      config: {
        name: 'test',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
      createdAt: '2024-01-01',
    };
    const result = getJahiaConnectionDefaults(env);
    expect(result.url).toBe('http://localhost:8080');
    expect(result.password).toBe('root1234');
  });

  test('uses overridden password from env config', () => {
    const env: PersistedEnvironment = {
      name: 'test',
      provider: 'docker',
      network: 'test-net',
      components: [],
      config: {
        name: 'test',
        provider: 'docker',
        components: [
          {
            name: 'jahia',
            overrides: { env: { SUPER_USER_PASSWORD: 'custom-pass' } },
          },
        ],
      },
      createdAt: '2024-01-01',
    };
    const result = getJahiaConnectionDefaults(env);
    expect(result.password).toBe('custom-pass');
  });

  test('uses overridden port from config', () => {
    const env: PersistedEnvironment = {
      name: 'test',
      provider: 'docker',
      network: 'test-net',
      components: [],
      config: {
        name: 'test',
        provider: 'docker',
        components: [
          {
            name: 'jahia',
            overrides: { ports: [{ container: 8080, host: 9090 }] },
          },
        ],
      },
      createdAt: '2024-01-01',
    };
    const result = getJahiaConnectionDefaults(env);
    expect(result.url).toBe('http://localhost:9090');
  });
});
