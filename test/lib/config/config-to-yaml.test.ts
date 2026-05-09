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

  test('serializes workflow section with steps', () => {
    const config: JahiaCliConfig = {
      workflow: {
        steps: [
          { name: 'Init', uses: 'tests:init' },
          { name: 'Build', run: 'npm run build' },
          { uses: 'environment:alive', with: { timeout: '300' } },
        ],
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const workflow = parsed['workflow'] as Record<string, unknown>;
    const steps = workflow['steps'] as Record<string, unknown>[];

    expect(steps).toHaveLength(3);
    expect(steps[0]?.['name']).toBe('Init');
    expect(steps[0]?.['uses']).toBe('tests:init');
    expect(steps[1]?.['run']).toBe('npm run build');
    expect((steps[2]?.['with'] as Record<string, unknown>)['timeout']).toBe('300');
  });

  test('serializes config with all three sections', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
      tests: { 'jahia-cypress': 'v1.0.0' },
      workflow: {
        steps: [{ run: 'echo hello' }],
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;

    expect(parsed['environment']).toBeDefined();
    expect(parsed['tests']).toBeDefined();
    expect(parsed['workflow']).toBeDefined();
  });

  test('omits workflow section when undefined', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;

    expect(parsed['workflow']).toBeUndefined();
  });
});
