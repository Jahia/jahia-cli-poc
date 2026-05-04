import { describe, expect, test } from 'vitest';
import yaml from 'js-yaml';

import { configToYaml } from '../../../src/lib/config/config-to-yaml.js';
import type { EnvironmentConfig } from '../../../src/lib/config/types.js';

describe('configToYaml', () => {
  test('serializes config with string components when no overrides are present', () => {
    const config: EnvironmentConfig = {
      name: 'my-env',
      provider: 'docker',
      components: [{ name: 'jahia' }, { name: 'pgsql' }],
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const components = parsed['components'] as unknown[];

    expect(parsed['name']).toBe('my-env');
    expect(parsed['provider']).toBe('docker');
    expect(components[0]).toBe('jahia');
    expect(components[1]).toBe('pgsql');
  });

  test('serializes component overrides as objects', () => {
    const config: EnvironmentConfig = {
      name: 'my-env',
      provider: 'docker',
      components: [{ name: 'elasticsearch', overrides: { tag: '8.11.0' } }],
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const components = parsed['components'] as Record<string, unknown>[];

    expect(components[0]?.['name']).toBe('elasticsearch');
    expect((components[0]?.['overrides'] as Record<string, unknown>)['tag']).toBe('8.11.0');
  });
});
