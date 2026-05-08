import { describe, expect, test } from 'vitest';
import yaml from 'js-yaml';

import { configToYaml } from '../../../src/lib/config/config-to-yaml.js';
import type { JahiaCliConfig } from '../../../src/lib/config/types.js';

describe('configToYaml', () => {
  test('serializes config with string components when no overrides are present', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const environment = parsed['environment'] as Record<string, unknown>;
    const components = environment['components'] as unknown[];

    expect(environment['name']).toBe('my-env');
    expect(environment['provider']).toBe('docker');
    expect(components[0]).toBe('jahia');
  });

  test('serializes tests metadata when provided', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
      tests: { 'jahia-cypress': 'v2.1.0' },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const tests = parsed['tests'] as Record<string, unknown>;

    expect(tests['jahia-cypress']).toBe('v2.1.0');
  });

  test('serializes component overrides as objects', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
        components: [{ name: 'jahia', overrides: { tag: '8.3.0.0' } }],
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const environment = parsed['environment'] as Record<string, unknown>;
    const components = environment['components'] as Record<string, unknown>[];

    expect(components[0]?.['name']).toBe('jahia');
    expect((components[0]?.['overrides'] as Record<string, unknown>)['tag']).toBe('8.3.0.0');
  });
});
