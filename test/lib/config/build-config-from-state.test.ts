import { describe, expect, test } from 'vitest';

import { buildConfigFromState } from '../../../src/lib/config/build-config-from-state.js';
import type { StateFile } from '../../../src/lib/state/types.js';

describe('buildConfigFromState', () => {
  test('extracts config from active state', () => {
    const state: StateFile = {
      version: 1,
      environment: {
        name: 'my-env',
        provider: 'docker',
        network: 'jahia-cli-my-env',
        components: [],
        config: {
          name: 'my-env',
          provider: 'docker',
          components: [{ name: 'jahia' }, { name: 'pgsql' }],
        },
        createdAt: '2026-05-04T20:00:00Z',
      },
    };

    const config = buildConfigFromState(state);
    expect(config.name).toBe('my-env');
    expect(config.provider).toBe('docker');
    expect(config.components).toHaveLength(2);
  });

  test('throws when state is missing', () => {
    expect(() => buildConfigFromState(undefined)).toThrow('No active environment configuration found');
  });

  test('throws when state has no environment', () => {
    const state: StateFile = { version: 1 };
    expect(() => buildConfigFromState(state)).toThrow('No active environment configuration found');
  });
});
