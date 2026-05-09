import { describe, expect, test } from 'vitest';

import {
  applyEnvInjections,
  getComponent,
  listComponentNames,
  listComponents,
  listComponentsByCategory,
  listTransparentComponents,
  listUserSelectableComponents,
  resolveComponent,
} from '../../../src/lib/components/index.js';

describe('Component Registry', () => {
  test('listComponentNames returns all registered names', () => {
    const names = listComponentNames();
    expect(names).toContain('jahia');
    expect(names).toContain('smtp-server');
    expect(names).toContain('victorialogs');
    expect(names).toHaveLength(3);
  });

  test('listComponents returns all definitions', () => {
    const components = listComponents();
    expect(components).toHaveLength(3);
    components.forEach((c) => {
      expect(c.name).toBeTruthy();
      expect(c.image).toBeTruthy();
      expect(c.defaultTag).toBeTruthy();
    });
  });

  test('listUserSelectableComponents excludes transparent components', () => {
    const selectable = listUserSelectableComponents();
    expect(selectable).toHaveLength(2);
    const names = selectable.map((c) => c.name);
    expect(names).toContain('jahia');
    expect(names).toContain('smtp-server');
  });

  test('listTransparentComponents returns only infrastructure', () => {
    const transparent = listTransparentComponents();
    expect(transparent).toHaveLength(1);
    expect(transparent[0]?.name).toBe('victorialogs');
  });

  test('listComponentsByCategory filters correctly', () => {
    const core = listComponentsByCategory('core');
    expect(core).toHaveLength(1);
    expect(core[0]?.name).toBe('jahia');

    const infra = listComponentsByCategory('infrastructure');
    expect(infra).toHaveLength(1);
    expect(infra[0]?.name).toBe('victorialogs');

    const utility = listComponentsByCategory('utility');
    expect(utility).toHaveLength(1);
    expect(utility[0]?.name).toBe('smtp-server');

    const database = listComponentsByCategory('database');
    expect(database).toHaveLength(0);
  });

  test('getComponent returns a definition by name', () => {
    const jahia = getComponent('jahia');
    expect(jahia).toBeDefined();
    expect(jahia?.image).toBe('jahia/jahia-ee');
    expect(jahia?.defaultTag).toBe('8.2.1.0');
  });

  test('getComponent returns victorialogs definition', () => {
    const vl = getComponent('victorialogs');
    expect(vl).toBeDefined();
    expect(vl?.image).toBe('victoriametrics/victoria-logs');
    expect(vl?.isTransparent).toBe(true);
    expect(vl?.category).toBe('infrastructure');
  });

  test('getComponent returns undefined for unknown name', () => {
    expect(getComponent('nonexistent')).toBeUndefined();
  });

  test('resolveComponent uses defaults when no overrides', () => {
    const def = getComponent('jahia');
    expect(def).toBeDefined();
    if (!def) return;
    const resolved = resolveComponent(def);
    expect(resolved.effectiveTag).toBe('8.2.1.0');
    expect(resolved.effectiveEnv['SUPER_USER_PASSWORD']).toBe('root1234');
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

  test('jahia has no dependencies (Derby default)', () => {
    const jahia = getComponent('jahia');
    expect(jahia).toBeDefined();
    expect(jahia?.dependsOn).toHaveLength(0);
  });

  test('jahia is core category and not transparent', () => {
    const jahia = getComponent('jahia');
    expect(jahia).toBeDefined();
    expect(jahia?.category).toBe('core');
    expect(jahia?.isTransparent).toBe(false);
  });

  test('victorialogs has no dependencies', () => {
    const vl = getComponent('victorialogs');
    expect(vl).toBeDefined();
    expect(vl?.dependsOn).toHaveLength(0);
  });

  test('smtp-server is utility category and user-selectable', () => {
    const smtp = getComponent('smtp-server');
    expect(smtp).toBeDefined();
    expect(smtp?.category).toBe('utility');
    expect(smtp?.isTransparent).toBe(false);
    expect(smtp?.image).toBe('axllent/mailpit');
    expect(smtp?.defaultTag).toBe('v1.27');
  });

  test('smtp-server exposes SMTP and web UI ports', () => {
    const smtp = getComponent('smtp-server');
    expect(smtp).toBeDefined();
    expect(smtp?.ports).toEqual([
      { container: 1025, host: 1025 },
      { container: 8025, host: 8025 },
    ]);
  });

  test('smtp-server declares envInjections for jahia', () => {
    const smtp = getComponent('smtp-server');
    expect(smtp).toBeDefined();
    expect(smtp?.envInjections).toEqual({
      jahia: { SMTP_SERVER_URL: 'smtp://smtp-server:1025' },
    });
  });
});

describe('applyEnvInjections', () => {
  test('injects SMTP_SERVER_URL into jahia when smtp-server is present', () => {
    const jahiaDef = getComponent('jahia');
    const smtpDef = getComponent('smtp-server');
    expect(jahiaDef).toBeDefined();
    expect(smtpDef).toBeDefined();
    if (!jahiaDef || !smtpDef) return;

    const jahiaResolved = resolveComponent(jahiaDef);
    const smtpResolved = resolveComponent(smtpDef);
    const result = applyEnvInjections([jahiaResolved, smtpResolved]);

    const jahiaResult = result.find((c) => c.definition.name === 'jahia');
    expect(jahiaResult).toBeDefined();
    expect(jahiaResult?.effectiveEnv['SMTP_SERVER_URL']).toBe('smtp://smtp-server:1025');
  });

  test('does not inject when smtp-server is absent', () => {
    const jahiaDef = getComponent('jahia');
    expect(jahiaDef).toBeDefined();
    if (!jahiaDef) return;

    const jahiaResolved = resolveComponent(jahiaDef);
    const result = applyEnvInjections([jahiaResolved]);

    const jahiaResult = result.find((c) => c.definition.name === 'jahia');
    expect(jahiaResult?.effectiveEnv['SMTP_SERVER_URL']).toBeUndefined();
  });

  test('preserves existing env vars when injecting', () => {
    const jahiaDef = getComponent('jahia');
    const smtpDef = getComponent('smtp-server');
    expect(jahiaDef).toBeDefined();
    expect(smtpDef).toBeDefined();
    if (!jahiaDef || !smtpDef) return;

    const jahiaResolved = resolveComponent(jahiaDef);
    const smtpResolved = resolveComponent(smtpDef);
    const result = applyEnvInjections([jahiaResolved, smtpResolved]);

    const jahiaResult = result.find((c) => c.definition.name === 'jahia');
    expect(jahiaResult?.effectiveEnv['SUPER_USER_PASSWORD']).toBe('root1234');
    expect(jahiaResult?.effectiveEnv['SMTP_SERVER_URL']).toBe('smtp://smtp-server:1025');
  });

  test('does not modify smtp-server component itself', () => {
    const jahiaDef = getComponent('jahia');
    const smtpDef = getComponent('smtp-server');
    expect(jahiaDef).toBeDefined();
    expect(smtpDef).toBeDefined();
    if (!jahiaDef || !smtpDef) return;

    const jahiaResolved = resolveComponent(jahiaDef);
    const smtpResolved = resolveComponent(smtpDef);
    const result = applyEnvInjections([jahiaResolved, smtpResolved]);

    const smtpResult = result.find((c) => c.definition.name === 'smtp-server');
    expect(smtpResult?.effectiveEnv).toEqual({});
  });
});
