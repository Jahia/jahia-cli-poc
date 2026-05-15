import { describe, expect, test } from 'vitest';

import { resolveJahiaPassword } from '../../../src/lib/state/get-jahia-connection-defaults.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

describe('resolveJahiaPassword', () => {
  test('returns default password when env is undefined', () => {
    expect(resolveJahiaPassword(undefined)).toBe('root1234');
  });

  test('returns overridden password from config', () => {
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
    expect(resolveJahiaPassword(env)).toBe('custom-pass');
  });
});
