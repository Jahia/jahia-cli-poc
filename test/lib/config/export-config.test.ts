import { describe, test, expect } from 'vitest';

import { extractExportableConfig, mergeEnvironmentIntoConfig } from '../../../src/lib/config/export-config.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

const makeEnvironment = (overrides: Partial<PersistedEnvironment> = {}): PersistedEnvironment => ({
  name: 'env-ff001122',
  provider: 'docker',
  composePath: '/workspace/environment/docker-compose.yml',
  config: {
    name: 'env-ff001122',
    provider: 'docker',
    composePath: '/workspace/config/docker-compose.yml',
  },
  createdAt: '2026-05-08T10:00:00Z',
  ...overrides,
});

describe('extractExportableConfig', () => {
  test('returns an EnvironmentConfig with provider and composePath', () => {
    const result = extractExportableConfig(makeEnvironment());
    expect(result).toEqual({
      name: 'env-ff001122',
      provider: 'docker',
      composePath: '/workspace/config/docker-compose.yml',
    });
  });

  test('uses config values rather than runtime state fields', () => {
    const result = extractExportableConfig(makeEnvironment({
      name: 'runtime-name',
      composePath: '/runtime/docker-compose.yml',
      config: {
        name: 'config-name',
        provider: 'docker',
        composePath: '/config/docker-compose.yml',
      },
    }));

    expect(result.name).toBe('config-name');
    expect(result.composePath).toBe('/config/docker-compose.yml');
  });

  test('does not include runtime metadata', () => {
    const result = extractExportableConfig(makeEnvironment());
    const json = JSON.stringify(result);
    expect(json).not.toContain('2026-05-08T10:00:00Z');
    expect(json).not.toContain('/workspace/environment/docker-compose.yml');
  });
});

describe('mergeEnvironmentIntoConfig', () => {
  test('preserves existing tests section when merging environment', () => {
    const existing = {
      tests: { 'jahia-cypress': '4.x' },
    };
    const envConfig = {
      name: 'my-env',
      provider: 'docker',
      composePath: './environment/docker-compose.yml',
    };
    const result = mergeEnvironmentIntoConfig(existing, envConfig);
    expect(result.tests).toEqual({ 'jahia-cypress': '4.x' });
    expect(result.environment).toEqual(envConfig);
  });

  test('replaces existing environment section', () => {
    const existing = {
      environment: {
        name: 'old-env',
        provider: 'docker',
        composePath: './old/docker-compose.yml',
      },
      tests: { 'jahia-cypress': '4.x' },
    };
    const envConfig = {
      name: 'new-env',
      provider: 'docker',
      composePath: './new/docker-compose.yml',
    };
    const result = mergeEnvironmentIntoConfig(existing, envConfig);
    expect(result.environment).toEqual(envConfig);
    expect(result.tests).toEqual({ 'jahia-cypress': '4.x' });
  });

  test('works with empty existing config', () => {
    const envConfig = {
      name: 'my-env',
      provider: 'docker',
      composePath: './environment/docker-compose.yml',
    };
    const result = mergeEnvironmentIntoConfig({}, envConfig);
    expect(result.environment).toEqual(envConfig);
  });
});
