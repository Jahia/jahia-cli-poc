import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { resolveConfigComponents, resolveComponentOverrides, parseTestContainerConfig } from '../../../src/lib/config/parser.js';
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

describe('resolveComponentOverrides (env var substitution)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('resolves ${VAR:-default} in tag override', () => {
    delete process.env['JAHIA_VERSION'];
    const result = resolveComponentOverrides({ tag: '${JAHIA_VERSION:-8.2.1.0}' });
    expect(result['tag']).toBe('8.2.1.0');
  });

  test('resolves ${VAR} in tag override from env', () => {
    process.env['JAHIA_VERSION'] = '8.3.0.0';
    const result = resolveComponentOverrides({ tag: '${JAHIA_VERSION:-8.2.1.0}' });
    expect(result['tag']).toBe('8.3.0.0');
  });

  test('resolves ${VAR:-default} in image override', () => {
    delete process.env['JAHIA_IMAGE'];
    const result = resolveComponentOverrides({ image: '${JAHIA_IMAGE:-jahia/jahia-ee}' });
    expect(result['image']).toBe('jahia/jahia-ee');
  });

  test('resolves env vars in image override from env', () => {
    process.env['JAHIA_IMAGE'] = 'my-registry.example.com/jahia/jahia-ee';
    const result = resolveComponentOverrides({ image: '${JAHIA_IMAGE:-jahia/jahia-ee}' });
    expect(result['image']).toBe('my-registry.example.com/jahia/jahia-ee');
  });

  test('resolves env vars in component env values', () => {
    process.env['DB_HOST'] = 'postgres.local';
    const result = resolveComponentOverrides({
      env: { DATABASE_HOST: '${DB_HOST:-localhost}' },
    });
    const env = result['env'] as Record<string, string>;
    expect(env['DATABASE_HOST']).toBe('postgres.local');
  });

  test('leaves non-string overrides unchanged', () => {
    const ports = [{ container: 8080, host: 9090 }];
    const result = resolveComponentOverrides({ ports });
    expect(result['ports']).toEqual(ports);
  });

  test('config with env var overrides parses correctly end-to-end', () => {
    process.env['TEST_JAHIA_TAG'] = '8.3.0.0';
    const config = validateConfig({
      environment: {
        name: 'test-env',
        provider: 'docker',
        components: [
          {
            name: 'jahia',
            overrides: {
              tag: '${TEST_JAHIA_TAG:-8.2.1.0}',
              image: '${TEST_JAHIA_IMAGE:-jahia/jahia-ee}',
            },
          },
        ],
      },
    });
    const jahiaComponent = config.environment?.components[0];
    expect(jahiaComponent?.overrides?.tag).toBe('8.3.0.0');
    expect(jahiaComponent?.overrides?.image).toBe('jahia/jahia-ee');
  });

  test('resolves alias with env var substitution', () => {
    process.env['TEST_ALIAS'] = 'custom-jahia';
    const result = resolveComponentOverrides({ alias: '${TEST_ALIAS:-default-jahia}' });
    expect(result['alias']).toBe('custom-jahia');
  });

  test('uses alias fallback when env var is not set', () => {
    delete process.env['NONEXISTENT_ALIAS'];
    const result = resolveComponentOverrides({ alias: '${NONEXISTENT_ALIAS:-my-jahia}' });
    expect(result['alias']).toBe('my-jahia');
  });

  test('throws on invalid alias with uppercase characters', () => {
    expect(() => resolveComponentOverrides({ alias: 'MyJahia' })).toThrow('Invalid alias');
  });

  test('throws on alias with leading hyphen', () => {
    expect(() => resolveComponentOverrides({ alias: '-jahia' })).toThrow('Invalid alias');
  });

  test('throws on alias with trailing hyphen', () => {
    expect(() => resolveComponentOverrides({ alias: 'jahia-' })).toThrow('Invalid alias');
  });

  test('throws on alias with spaces', () => {
    expect(() => resolveComponentOverrides({ alias: 'my jahia' })).toThrow('Invalid alias');
  });

  test('accepts valid alias with hyphens', () => {
    const result = resolveComponentOverrides({ alias: 'my-custom-jahia' });
    expect(result['alias']).toBe('my-custom-jahia');
  });

  test('accepts single-character alias', () => {
    const result = resolveComponentOverrides({ alias: 'j' });
    expect(result['alias']).toBe('j');
  });
});

describe('parseTestContainerConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('returns undefined when input is undefined', () => {
    expect(parseTestContainerConfig(undefined)).toBeUndefined();
  });

  test('returns undefined when object has no recognized fields', () => {
    expect(parseTestContainerConfig({})).toBeUndefined();
  });

  test('parses dockerfile field', () => {
    const result = parseTestContainerConfig({ dockerfile: 'custom/Dockerfile' });
    expect(result?.dockerfile).toBe('custom/Dockerfile');
  });

  test('parses image with env var resolution', () => {
    process.env['MY_IMAGE'] = 'custom-image';
    const result = parseTestContainerConfig({ image: '${MY_IMAGE:-jahia-tests}' });
    expect(result?.image).toBe('custom-image');
  });

  test('parses image with default when env not set', () => {
    delete process.env['MY_IMAGE'];
    const result = parseTestContainerConfig({ image: '${MY_IMAGE:-jahia-tests}' });
    expect(result?.image).toBe('jahia-tests');
  });

  test('parses tag with env var resolution', () => {
    process.env['MY_TAG'] = '2.0.0';
    const result = parseTestContainerConfig({ tag: '${MY_TAG:-latest}' });
    expect(result?.tag).toBe('2.0.0');
  });

  test('parses platform field', () => {
    const result = parseTestContainerConfig({ platform: 'linux/amd64' });
    expect(result?.platform).toBe('linux/amd64');
  });

  test('parses buildArgs with env var resolution', () => {
    process.env['CYPRESS_VER'] = '13.0.0';
    const result = parseTestContainerConfig({
      buildArgs: { CYPRESS_VERSION: '${CYPRESS_VER:-12.0.0}' },
    });
    expect(result?.buildArgs?.['CYPRESS_VERSION']).toBe('13.0.0');
  });

  test('throws when container is not an object', () => {
    expect(() => parseTestContainerConfig('bad')).toThrow(
      'Configuration "tests.container" must be an object',
    );
  });

  test('throws when dockerfile is not a string', () => {
    expect(() => parseTestContainerConfig({ dockerfile: 123 })).toThrow(
      'Configuration "tests.container.dockerfile" must be a string',
    );
  });

  test('throws when image is not a string', () => {
    expect(() => parseTestContainerConfig({ image: 123 })).toThrow(
      'Configuration "tests.container.image" must be a string',
    );
  });

  test('throws when tag is not a string', () => {
    expect(() => parseTestContainerConfig({ tag: 123 })).toThrow(
      'Configuration "tests.container.tag" must be a string',
    );
  });

  test('throws when platform is not a string', () => {
    expect(() => parseTestContainerConfig({ platform: 123 })).toThrow(
      'Configuration "tests.container.platform" must be a string',
    );
  });

  test('throws when buildArgs is not an object', () => {
    expect(() => parseTestContainerConfig({ buildArgs: 'bad' })).toThrow(
      'Configuration "tests.container.buildArgs" must be an object',
    );
  });

  test('end-to-end: tests.container in full config', () => {
    process.env['E2E_TAG'] = 'ci-123';
    const config = validateConfig({
      tests: {
        container: {
          image: 'my-tests',
          tag: '${E2E_TAG:-latest}',
          platform: 'linux/arm64',
          buildArgs: { NODE_VERSION: '20' },
        },
      },
    });
    expect(config.tests?.container?.image).toBe('my-tests');
    expect(config.tests?.container?.tag).toBe('ci-123');
    expect(config.tests?.container?.platform).toBe('linux/arm64');
    expect(config.tests?.container?.buildArgs?.['NODE_VERSION']).toBe('20');
  });
});
