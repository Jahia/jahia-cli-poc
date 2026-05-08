import { describe, test, expect } from 'vitest';

import { extractExportableConfig } from '../../../src/lib/config/export-config.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

const makeEnvironment = (overrides: Partial<PersistedEnvironment> = {}): PersistedEnvironment => ({
  name: 'env-ff001122',
  provider: 'docker',
  network: 'jahia-cli-env-ff001122',
  components: [
    { name: 'jahia', image: 'jahia/jahia-ee', tag: '8.2.3.0', containerId: 'container-aaa111' },
    { name: 'victorialogs', image: 'victoriametrics/victoria-logs', tag: '1.20.2-victorialogs', containerId: 'container-bbb222' },
  ],
  config: {
    name: 'env-ff001122',
    provider: 'docker',
    components: [
      { name: 'jahia', overrides: { tag: '8.2.3.0' } },
    ],
  },
  createdAt: '2026-05-08T10:00:00Z',
  ...overrides,
});

describe('extractExportableConfig', () => {
  test('returns a JahiaCliConfig with environment section', () => {
    const result = extractExportableConfig(makeEnvironment());
    expect(result.environment).toBeDefined();
  });

  test('preserves provider from config', () => {
    const result = extractExportableConfig(makeEnvironment());
    expect(result.environment?.provider).toBe('docker');
  });

  test('preserves environment name from config', () => {
    const result = extractExportableConfig(makeEnvironment());
    expect(result.environment?.name).toBe('env-ff001122');
  });

  test('preserves components with overrides', () => {
    const result = extractExportableConfig(makeEnvironment());
    expect(result.environment?.components).toEqual([
      { name: 'jahia', overrides: { tag: '8.2.3.0' } },
    ]);
  });

  test('excludes transparent components (victorialogs) from export', () => {
    const env = makeEnvironment({
      config: {
        name: 'env-ff001122',
        provider: 'docker',
        components: [
          { name: 'jahia', overrides: { tag: '8.2.3.0' } },
          { name: 'victorialogs' },
        ],
      },
    });
    const result = extractExportableConfig(env);
    const names = result.environment?.components.map((c) => c.name);
    expect(names).toEqual(['jahia']);
    expect(names).not.toContain('victorialogs');
  });

  test('keeps components without overrides', () => {
    const env = makeEnvironment({
      config: {
        name: 'env-ff001122',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
    });
    const result = extractExportableConfig(env);
    expect(result.environment?.components).toEqual([{ name: 'jahia' }]);
  });

  test('does not include runtime data (no containerId, timestamps, network)', () => {
    const result = extractExportableConfig(makeEnvironment());
    const json = JSON.stringify(result);
    expect(json).not.toContain('container-aaa111');
    expect(json).not.toContain('container-bbb222');
    expect(json).not.toContain('jahia-cli-env-ff001122');
    expect(json).not.toContain('2026-05-08T10:00:00Z');
  });
});
