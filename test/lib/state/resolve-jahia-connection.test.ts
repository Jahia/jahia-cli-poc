import { describe, expect, test } from 'vitest';

import { resolveJahiaPassword } from '../../../src/lib/state/get-jahia-connection-defaults.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

describe('resolveJahiaPassword', () => {
  test('returns the default password when env is undefined', () => {
    expect(resolveJahiaPassword(undefined)).toBe('root1234');
  });

  test('ignores persisted environment details and still returns the default password', () => {
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

    expect(resolveJahiaPassword(env)).toBe('root1234');
  });
});
