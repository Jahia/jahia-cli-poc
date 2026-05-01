import { describe, expect, test } from 'vitest';

import {
  getComponent,
  listComponentNames,
  listComponents,
  resolveComponent,
} from '../../../src/lib/components/index.js';

describe('Component Registry', () => {
  test('listComponentNames returns all registered names', () => {
    const names = listComponentNames();
    expect(names).toContain('jahia');
    expect(names).toContain('pgsql');
    expect(names).toContain('elasticsearch');
    expect(names).toContain('jahia-browsing');
  });

  test('listComponents returns all definitions', () => {
    const components = listComponents();
    expect(components.length).toBeGreaterThanOrEqual(4);
    components.forEach((c) => {
      expect(c.name).toBeTruthy();
      expect(c.image).toBeTruthy();
      expect(c.defaultTag).toBeTruthy();
    });
  });

  test('getComponent returns a definition by name', () => {
    const pgsql = getComponent('pgsql');
    expect(pgsql).toBeDefined();
    expect(pgsql?.image).toBe('postgres');
    expect(pgsql?.defaultTag).toBe('16-alpine');
  });

  test('getComponent returns undefined for unknown name', () => {
    expect(getComponent('nonexistent')).toBeUndefined();
  });

  test('resolveComponent uses defaults when no overrides', () => {
    const def = getComponent('pgsql');
    expect(def).toBeDefined();
    if (!def) return;
    const resolved = resolveComponent(def);
    expect(resolved.effectiveTag).toBe('16-alpine');
    expect(resolved.effectiveEnv['POSTGRES_DB']).toBe('jahia');
    expect(resolved.effectivePorts).toEqual(def.ports);
  });

  test('resolveComponent applies tag override', () => {
    const def = getComponent('jahia');
    expect(def).toBeDefined();
    if (!def) return;
    const resolved = resolveComponent(def, { tag: '8.3.0.0' });
    expect(resolved.effectiveTag).toBe('8.3.0.0');
  });

  test('resolveComponent merges env overrides', () => {
    const def = getComponent('jahia');
    expect(def).toBeDefined();
    if (!def) return;
    const resolved = resolveComponent(def, {
      env: { SUPER_USER_PASSWORD: 'custom', NEW_VAR: 'value' },
    });
    expect(resolved.effectiveEnv['SUPER_USER_PASSWORD']).toBe('custom');
    expect(resolved.effectiveEnv['NEW_VAR']).toBe('value');
    expect(resolved.effectiveEnv['MAX_RAM_PERCENTAGE']).toBe('80');
  });

  test('resolveComponent applies port overrides', () => {
    const def = getComponent('jahia');
    expect(def).toBeDefined();
    if (!def) return;
    const customPorts = [{ container: 8080, host: 9090 }] as const;
    const resolved = resolveComponent(def, { ports: customPorts });
    expect(resolved.effectivePorts).toEqual(customPorts);
  });

  test('jahia depends on pgsql and elasticsearch', () => {
    const jahia = getComponent('jahia');
    expect(jahia).toBeDefined();
    expect(jahia?.dependsOn).toContain('pgsql');
    expect(jahia?.dependsOn).toContain('elasticsearch');
  });

  test('jahia-browsing depends on jahia', () => {
    const browsing = getComponent('jahia-browsing');
    expect(browsing).toBeDefined();
    expect(browsing?.dependsOn).toContain('jahia');
  });

  test('pgsql has no dependencies', () => {
    const pgsql = getComponent('pgsql');
    expect(pgsql).toBeDefined();
    expect(pgsql?.dependsOn).toHaveLength(0);
  });
});
