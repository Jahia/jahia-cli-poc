import { describe, test, expect } from 'vitest';
import { getProvider, listProviderNames } from '../../../src/lib/providers/index.js';

describe('provider registry', () => {
  test('listProviderNames returns all registered providers', () => {
    const names = listProviderNames();
    expect(names).toContain('docker');
    expect(names).toContain('jahiacloudv1');
  });

  test('getProvider returns a valid provider for "docker"', () => {
    const provider = getProvider('docker');
    expect(provider.name).toBe('docker');
    expect(typeof provider.createEnvironment).toBe('function');
  });

  test('getProvider returns a valid provider for "jahiacloudv1"', () => {
    const provider = getProvider('jahiacloudv1');
    expect(provider.name).toBe('jahiacloudv1');
  });

  test('getProvider throws for an unknown provider name', () => {
    expect(() => getProvider('nonexistent')).toThrow('Unknown provider "nonexistent"');
    expect(() => getProvider('nonexistent')).toThrow('docker');
  });
});
