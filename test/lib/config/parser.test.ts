import { describe, expect, test } from 'vitest';

import { resolveConfigComponents } from '../../../src/lib/config/parser.js';
import { validateConfig } from '../../../src/lib/config/parser.js';

describe('Config Validator', () => {
  test('validates a minimal config with string components', () => {
    const config = validateConfig({
      environment: {
        name: 'test-env',
        provider: 'docker',
        components: ['jahia', 'pgsql'],
      },
    });
    expect(config.environment.name).toBe('test-env');
    expect(config.environment.provider).toBe('docker');
    expect(config.environment.components).toHaveLength(2);
    expect(config.environment.components[0]?.name).toBe('jahia');
  });

  test('validates config with tests metadata', () => {
    const config = validateConfig({
      environment: { components: ['pgsql'] },
      tests: { 'jahia-cypress': 'v1.2.3' },
    });
    expect(config.tests?.['jahia-cypress']).toBe('v1.2.3');
  });

  test('validates config with object components', () => {
    const config = validateConfig({
      environment: {
        components: [{ name: 'jahia', overrides: { tag: '8.3.0.0' } }, { name: 'pgsql' }],
      },
    });
    expect(config.environment.components[0]?.overrides?.tag).toBe('8.3.0.0');
  });

  test('generates name and defaults provider when not specified', () => {
    const config = validateConfig({ environment: { components: ['pgsql'] } });
    expect(config.environment.name).toMatch(/^env-[a-f0-9]{8}$/);
    expect(config.environment.provider).toBe('docker');
  });

  test('throws on empty components array', () => {
    expect(() => validateConfig({ environment: { components: [] } })).toThrow(
      'at least one component',
    );
  });

  test('throws on missing environment section', () => {
    expect(() => validateConfig({})).toThrow('must include an "environment" section');
  });

  test('throws on invalid component entry', () => {
    expect(() => validateConfig({ environment: { components: [123] } })).toThrow(
      'must be a string or an object',
    );
  });
});

describe('resolveConfigComponents', () => {
  test('resolves known components', () => {
    const config = validateConfig({
      environment: {
        name: 'test',
        provider: 'docker',
        components: ['pgsql', 'elasticsearch'],
      },
    });
    const resolved = resolveConfigComponents(config.environment);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.definition.name).toBe('pgsql');
    expect(resolved[1]?.definition.name).toBe('elasticsearch');
  });

  test('throws on unknown component', () => {
    const config = validateConfig({
      environment: {
        name: 'test',
        provider: 'docker',
        components: ['unknown-thing'],
      },
    });
    expect(() => resolveConfigComponents(config.environment)).toThrow(
      'Unknown component "unknown-thing"',
    );
  });

  test('applies overrides when resolving', () => {
    const config = validateConfig({
      environment: {
        name: 'test',
        provider: 'docker',
        components: [{ name: 'jahia', overrides: { tag: '8.3.0.0' } }],
      },
    });
    const resolved = resolveConfigComponents(config.environment);
    expect(resolved[0]?.effectiveTag).toBe('8.3.0.0');
  });
});

describe('validateConfig (additional branches)', () => {
  test('throws when tests field is not an object', () => {
    expect(() =>
      validateConfig({ environment: { components: ['pgsql'] }, tests: 'bad' }),
    ).toThrow('Configuration "tests" field must be an object');
  });

  test('throws when tests.jahia-cypress is not a string', () => {
    expect(() =>
      validateConfig({
        environment: { components: ['pgsql'] },
        tests: { 'jahia-cypress': 42 },
      }),
    ).toThrow('Configuration "tests.jahia-cypress" must be a string');
  });

  test('throws when component object has non-string name', () => {
    expect(() => validateConfig({ environment: { components: [{ name: 42 }] } })).toThrow(
      'must have a string "name" field',
    );
  });

  test('validates config with scaffolding section', () => {
    const config = validateConfig({
      environment: { components: ['pgsql'] },
      tests: { scaffolding: { repository: 'https://example.com/repo', path: 'src/', version: 'v2.0' } },
    });
    expect(config.tests?.scaffolding).toEqual({
      repository: 'https://example.com/repo',
      path: 'src/',
      version: 'v2.0',
    });
  });

  test('applies scaffolding defaults when fields are omitted', () => {
    const config = validateConfig({
      environment: { components: ['pgsql'] },
      tests: { scaffolding: {} },
    });
    expect(config.tests?.scaffolding).toEqual({
      repository: 'https://github.com/Jahia/jahia-cypress',
      path: 'scaffolding/',
      version: 'latest',
    });
  });

  test('throws when tests.scaffolding is not an object', () => {
    expect(() =>
      validateConfig({ environment: { components: ['pgsql'] }, tests: { scaffolding: 'bad' } }),
    ).toThrow('Configuration "tests.scaffolding" must be an object');
  });

  test('throws when scaffolding.repository is not a string', () => {
    expect(() =>
      validateConfig({ environment: { components: ['pgsql'] }, tests: { scaffolding: { repository: 123 } } }),
    ).toThrow('Configuration "tests.scaffolding.repository" must be a string');
  });

  test('throws when scaffolding.path is not a string', () => {
    expect(() =>
      validateConfig({ environment: { components: ['pgsql'] }, tests: { scaffolding: { path: 123 } } }),
    ).toThrow('Configuration "tests.scaffolding.path" must be a string');
  });

  test('throws when scaffolding.version is not a string', () => {
    expect(() =>
      validateConfig({ environment: { components: ['pgsql'] }, tests: { scaffolding: { version: 123 } } }),
    ).toThrow('Configuration "tests.scaffolding.version" must be a string');
  });
});

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfigFile } from '../../../src/lib/config/parser.js';

describe('loadConfigFile', () => {
  test('reads and parses a valid YAML config file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const file = join(dir, 'env.yaml');
    await writeFile(
      file,
      'environment:\n  name: test-env\n  provider: docker\n  components:\n    - pgsql\ntests:\n  jahia-cypress: v3.0.0\n',
    );
    try {
      const config = await loadConfigFile(file);
      expect(config.environment.name).toBe('test-env');
      expect(config.environment.provider).toBe('docker');
      expect(config.environment.components[0]?.name).toBe('pgsql');
      expect(config.tests?.['jahia-cypress']).toBe('v3.0.0');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
