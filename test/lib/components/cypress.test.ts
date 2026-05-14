import { describe, expect, test } from 'vitest';

import { cypress } from '../../../src/lib/components/cypress.js';
import { COMPONENT_REGISTRY, resolveComponent } from '../../../src/lib/components/index.js';

describe('cypress component', () => {
  test('is registered in the component registry', () => {
    expect(COMPONENT_REGISTRY['cypress']).toBeDefined();
  });

  test('has correct base properties', () => {
    expect(cypress.name).toBe('cypress');
    expect(cypress.image).toBe('jahia-tests');
    expect(cypress.defaultTag).toBe('latest');
    expect(cypress.category).toBe('application');
    expect(cypress.isTransparent).toBe(false);
    expect(cypress.ports).toEqual([]);
    expect(cypress.volumes).toEqual([]);
  });

  test('depends on jahia', () => {
    expect(cypress.dependsOn).toContain('jahia');
  });

  test('has in-network env defaults', () => {
    expect(cypress.env['JAHIA_URL']).toBe('http://jahia:8080');
    expect(cypress.env['SUPER_USER_PASSWORD']).toContain('SUPER_USER_PASSWORD');
    expect(cypress.env['NEXUS_USERNAME']).toContain('NEXUS_USERNAME');
  });

  test('has cypress network alias', () => {
    expect(cypress.networkAliases).toContain('cypress');
  });

  test('resolves with overrides', () => {
    const resolved = resolveComponent(cypress, {
      image: 'my-tests:v2',
      env: { EXTRA: 'value' },
    });
    expect(resolved.effectiveImage).toBe('my-tests');
    expect(resolved.effectiveTag).toBe('v2');
    expect(resolved.effectiveEnv['EXTRA']).toBe('value');
    expect(resolved.effectiveEnv['JAHIA_URL']).toBe('http://jahia:8080');
  });
});
