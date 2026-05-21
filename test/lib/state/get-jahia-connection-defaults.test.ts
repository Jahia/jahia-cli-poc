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

  test('returns the same defaults when an environment is provided', () => {
    const env: PersistedEnvironment = {
      name: 'test',
      provider: 'docker',
      composePath: '/workspace/environment/docker-compose.yml',
      config: {
        name: 'test',
        provider: 'docker',
        composePath: '/workspace/environment/docker-compose.yml',
      },
      createdAt: '2024-01-01',
    };
    const result = getJahiaConnectionDefaults(env);
    expect(result).toEqual({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
    });
  });
});
