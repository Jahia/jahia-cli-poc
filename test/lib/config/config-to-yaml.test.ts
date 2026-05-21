import { describe, expect, test } from 'vitest';
import yaml from 'js-yaml';

import { configToYaml } from '../../../src/lib/config/config-to-yaml.js';
import type { JahiaCliConfig } from '../../../src/lib/config/types.js';

describe('configToYaml', () => {
  test('serializes config with environment section', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
        composePath: '/path/to/docker-compose.yml',
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const environment = parsed['environment'] as Record<string, unknown>;

    expect(environment['name']).toBe('my-env');
    expect(environment['provider']).toBe('docker');
    expect(environment['composePath']).toBe('/path/to/docker-compose.yml');
  });

  test('serializes tests metadata when provided', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
      },
      tests: { 'jahia-cypress': 'v2.1.0' },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const tests = parsed['tests'] as Record<string, unknown>;

    expect(tests['jahia-cypress']).toBe('v2.1.0');
  });

  test('serializes workflows section with named entries', () => {
    const config: JahiaCliConfig = {
      workflows: {
        main: {
          default: true,
          steps: [
            { name: 'Init', uses: 'tests:init' },
            { name: 'Build', run: 'npm run build' },
            { uses: 'jahia:alive', with: { timeout: '300' } },
          ],
        },
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const workflows = parsed['workflows'] as Record<string, Record<string, unknown>>;
    const main = workflows['main'];
    const steps = main?.['steps'] as Record<string, unknown>[];

    expect(main?.['default']).toBe(true);
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
      },
      tests: { 'jahia-cypress': 'v1.0.0' },
      workflows: {
        main: {
          default: true,
          steps: [{ run: 'echo hello' }],
        },
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;

    expect(parsed['environment']).toBeDefined();
    expect(parsed['tests']).toBeDefined();
    expect(parsed['workflows']).toBeDefined();
  });

  test('omits workflows section when undefined', () => {
    const config: JahiaCliConfig = {
      environment: {
        name: 'my-env',
        provider: 'docker',
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;

    expect(parsed['workflows']).toBeUndefined();
  });

  test('serializes multiple named workflows', () => {
    const config: JahiaCliConfig = {
      workflows: {
        setup: {
          steps: [{ uses: 'environment:create' }],
        },
        test: {
          steps: [{ run: 'yarn test' }],
        },
        full: {
          default: true,
          steps: [
            { uses: 'workflow:run', with: { name: 'setup' } },
            { uses: 'workflow:run', with: { name: 'test' } },
          ],
        },
      },
    };

    const content = configToYaml(config);
    const parsed = yaml.load(content) as Record<string, unknown>;
    const workflows = parsed['workflows'] as Record<string, Record<string, unknown>>;

    expect(Object.keys(workflows)).toHaveLength(3);
    expect(workflows['full']?.['default']).toBe(true);
    expect(workflows['setup']?.['default']).toBeUndefined();
  });
});
