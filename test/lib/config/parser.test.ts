import { describe, expect, test } from 'vitest';

import { resolveConfigComponents } from '../../../src/lib/config/parser.js';
import { validateConfig } from '../../../src/lib/config/parser.js';

describe('Config Validator', () => {
  test('validates a minimal config with string components', () => {
    const config = validateConfig({
      environment: {
        name: 'test-env',
        provider: 'docker',
        components: ['jahia'],
      },
    });
    expect(config.environment.name).toBe('test-env');
    expect(config.environment.provider).toBe('docker');
    expect(config.environment.components).toHaveLength(1);
    expect(config.environment.components[0]?.name).toBe('jahia');
  });

  test('validates config with tests metadata', () => {
    const config = validateConfig({
      environment: { components: ['jahia'] },
      tests: { 'jahia-cypress': 'v1.2.3' },
    });
    expect(config.tests?.['jahia-cypress']).toBe('v1.2.3');
  });

  test('validates config with object components', () => {
    const config = validateConfig({
      environment: {
        components: [{ name: 'jahia', overrides: { tag: '8.3.0.0' } }],
      },
    });
    expect(config.environment.components[0]?.overrides?.tag).toBe('8.3.0.0');
  });

  test('generates name and defaults provider when not specified', () => {
    const config = validateConfig({ environment: { components: ['jahia'] } });
    expect(config.environment.name).toMatch(/^env-[a-f0-9]{8}$/);
    expect(config.environment.provider).toBe('docker');
  });

  test('returns undefined environment when components array is empty', () => {
    const result = validateConfig({ environment: { components: [] } });
    expect(result.environment).toBeUndefined();
  });

  test('returns config without environment when environment section is missing', () => {
    const result = validateConfig({});
    expect(result.environment).toBeUndefined();
  });

  test('returns undefined environment on invalid component entry (no components length > 0)', () => {
    // When components has entries but they're invalid, validation still runs
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
        components: ['jahia'],
      },
    });
    const resolved = resolveConfigComponents(config.environment);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.definition.name).toBe('jahia');
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
      validateConfig({ environment: { components: ['jahia'] }, tests: 'bad' }),
    ).toThrow('Configuration "tests" field must be an object');
  });

  test('throws when tests.jahia-cypress is not a string', () => {
    expect(() =>
      validateConfig({
        environment: { components: ['jahia'] },
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
      environment: { components: ['jahia'] },
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
      environment: { components: ['jahia'] },
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
      validateConfig({ environment: { components: ['jahia'] }, tests: { scaffolding: 'bad' } }),
    ).toThrow('Configuration "tests.scaffolding" must be an object');
  });

  test('throws when scaffolding.repository is not a string', () => {
    expect(() =>
      validateConfig({ environment: { components: ['jahia'] }, tests: { scaffolding: { repository: 123 } } }),
    ).toThrow('Configuration "tests.scaffolding.repository" must be a string');
  });

  test('throws when scaffolding.path is not a string', () => {
    expect(() =>
      validateConfig({ environment: { components: ['jahia'] }, tests: { scaffolding: { path: 123 } } }),
    ).toThrow('Configuration "tests.scaffolding.path" must be a string');
  });

  test('throws when scaffolding.version is not a string', () => {
    expect(() =>
      validateConfig({ environment: { components: ['jahia'] }, tests: { scaffolding: { version: 123 } } }),
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
      'environment:\n  name: test-env\n  provider: docker\n  components:\n    - jahia\ntests:\n  jahia-cypress: v3.0.0\n',
    );
    try {
      const config = await loadConfigFile(file);
      expect(config.environment.name).toBe('test-env');
      expect(config.environment.provider).toBe('docker');
      expect(config.environment.components[0]?.name).toBe('jahia');
      expect(config.tests?.['jahia-cypress']).toBe('v3.0.0');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
