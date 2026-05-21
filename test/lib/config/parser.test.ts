import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

import {
  loadConfigFile,
  parseTestContainerConfig,
  resolveConfigComponents,
  resolveComponentOverrides,
  validateConfig,
} from '../../../src/lib/config/parser.js';

const createConfigDir = async (): Promise<string> => {
  const dir = resolve('.test-artifacts', `parser-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
};

describe('validateConfig', () => {
  test('validates a minimal config with composePath', () => {
    const config = validateConfig({
      environment: {
        name: 'test-env',
        provider: 'docker',
        composePath: './environment/docker-compose.yml',
      },
    });
    expect(config.environment).toEqual({
      name: 'test-env',
      provider: 'docker',
      composePath: './environment/docker-compose.yml',
    });
  });

  test('validates config with tests metadata', () => {
    const config = validateConfig({
      environment: { composePath: './environment/docker-compose.yml' },
      tests: { 'jahia-cypress': 'v1.2.3' },
    });
    expect(config.tests?.['jahia-cypress']).toBe('v1.2.3');
    expect(config.environment?.provider).toBe('docker');
  });

  test('generates name and defaults provider when composePath is present', () => {
    const config = validateConfig({ environment: { composePath: './environment/docker-compose.yml' } });
    expect(config.environment?.name).toMatch(/^env-[a-f0-9]{8}$/);
    expect(config.environment?.provider).toBe('docker');
  });

  test('returns undefined environment when section has no recognized fields', () => {
    const result = validateConfig({ environment: {} });
    expect(result.environment).toBeUndefined();
  });

  test('ignores legacy components data when composePath is not provided', () => {
    const result = validateConfig({
      environment: {
        components: ['jahia'],
      },
    });
    expect(result.environment).toBeUndefined();
  });

  test('throws when tests field is not an object', () => {
    expect(() =>
      validateConfig({ environment: { composePath: './environment/docker-compose.yml' }, tests: 'bad' }),
    ).toThrow('Configuration "tests" field must be an object');
  });

  test('throws when tests.jahia-cypress is not a string', () => {
    expect(() =>
      validateConfig({
        environment: { composePath: './environment/docker-compose.yml' },
        tests: { 'jahia-cypress': 42 },
      }),
    ).toThrow('Configuration "tests.jahia-cypress" must be a string');
  });

  test('validates config with scaffolding section', () => {
    const config = validateConfig({
      tests: { scaffolding: { repository: 'https://example.com/repo', path: 'src/', version: 'v2.0' } },
    });
    expect(config.tests?.scaffolding).toEqual({
      repository: 'https://example.com/repo',
      path: 'src/',
      version: 'v2.0',
    });
  });

  test('applies scaffolding defaults when fields are omitted', () => {
    const config = validateConfig({ tests: { scaffolding: {} } });
    expect(config.tests?.scaffolding).toEqual({
      repository: 'https://github.com/Jahia/jahia-cypress',
      path: 'scaffolding/',
      version: 'latest',
    });
  });
});

describe('resolveConfigComponents', () => {
  test('returns composePath when configured', () => {
    const config = validateConfig({
      environment: {
        name: 'test',
        provider: 'docker',
        composePath: './environment/docker-compose.yml',
      },
    });
    expect(config.environment !== undefined && resolveConfigComponents(config.environment)).toBe('./environment/docker-compose.yml');
  });

  test('throws when composePath is missing', () => {
    expect(() => resolveConfigComponents({ name: 'test', provider: 'docker' })).toThrow(
      'No composePath configured',
    );
  });
});

describe('loadConfigFile', () => {
  test('reads and parses a valid YAML config file', async () => {
    const dir = await createConfigDir();
    const file = join(dir, 'env.yaml');
    await writeFile(
      file,
      'environment:\n  name: test-env\n  provider: docker\n  composePath: ./environment/docker-compose.yml\ntests:\n  jahia-cypress: v3.0.0\n',
    );
    try {
      const config = await loadConfigFile(file);
      expect(config.environment).toEqual({
        name: 'test-env',
        provider: 'docker',
        composePath: './environment/docker-compose.yml',
      });
      expect(config.tests?.['jahia-cypress']).toBe('v3.0.0');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('resolveComponentOverrides', () => {
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

  test('resolves alias with env var substitution', () => {
    process.env['TEST_ALIAS'] = 'custom-jahia';
    const result = resolveComponentOverrides({ alias: '${TEST_ALIAS:-default-jahia}' });
    expect(result['alias']).toBe('custom-jahia');
  });

  test('throws on invalid alias with uppercase characters', () => {
    expect(() => resolveComponentOverrides({ alias: 'MyJahia' })).toThrow('Invalid alias');
  });

  test('accepts valid alias with hyphens', () => {
    const result = resolveComponentOverrides({ alias: 'my-custom-jahia' });
    expect(result['alias']).toBe('my-custom-jahia');
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

  test('throws when image is not a string', () => {
    expect(() => parseTestContainerConfig({ image: 123 })).toThrow(
      'Configuration "tests.container.image" must be a string',
    );
  });

  test('end-to-end: tests.container in full config', () => {
    process.env['TEST_IMAGE'] = 'ci-image';
    const config = validateConfig({
      tests: {
        container: {
          image: '${TEST_IMAGE:-jahia-tests}',
          tag: 'latest',
        },
      },
    });
    expect(config.tests?.container?.image).toBe('ci-image');
    expect(config.tests?.container?.tag).toBe('latest');
  });
});
