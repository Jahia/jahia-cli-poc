import { describe, expect, test } from 'vitest';

import { resolveConfigComponents } from '../../../src/lib/config/parser.js';
import { validateConfig } from '../../../src/lib/config/parser.js';

describe('Config Validator', () => {
  test('validates a minimal config with string components', () => {
    const config = validateConfig({
      name: 'test-env',
      provider: 'docker',
      components: ['jahia', 'pgsql'],
    });
    expect(config.name).toBe('test-env');
    expect(config.provider).toBe('docker');
    expect(config.components).toHaveLength(2);
    expect(config.components[0]?.name).toBe('jahia');
  });

  test('validates config with object components', () => {
    const config = validateConfig({
      components: [
        { name: 'jahia', overrides: { tag: '8.3.0.0' } },
        { name: 'pgsql' },
      ],
    });
    expect(config.components[0]?.overrides?.tag).toBe('8.3.0.0');
  });

  test('generates name and defaults provider when not specified', () => {
    const config = validateConfig({ components: ['pgsql'] });
    expect(config.name).toMatch(/^env-[a-f0-9]{8}$/);
    expect(config.provider).toBe('docker');
  });

  test('throws on empty components array', () => {
    expect(() => validateConfig({ components: [] })).toThrow('at least one component');
  });

  test('throws on missing components', () => {
    expect(() => validateConfig({})).toThrow('at least one component');
  });

  test('throws on invalid component entry', () => {
    expect(() => validateConfig({ components: [123] })).toThrow('must be a string or an object');
  });
});

describe('resolveConfigComponents', () => {
  test('resolves known components', () => {
    const config = validateConfig({
      name: 'test',
      provider: 'docker',
      components: ['pgsql', 'elasticsearch'],
    });
    const resolved = resolveConfigComponents(config);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.definition.name).toBe('pgsql');
    expect(resolved[1]?.definition.name).toBe('elasticsearch');
  });

  test('throws on unknown component', () => {
    const config = validateConfig({
      name: 'test',
      provider: 'docker',
      components: ['unknown-thing'],
    });
    expect(() => resolveConfigComponents(config)).toThrow('Unknown component "unknown-thing"');
  });

  test('applies overrides when resolving', () => {
    const config = validateConfig({
      name: 'test',
      provider: 'docker',
      components: [{ name: 'jahia', overrides: { tag: '8.3.0.0' } }],
    });
    const resolved = resolveConfigComponents(config);
    expect(resolved[0]?.effectiveTag).toBe('8.3.0.0');
  });
});
