import { describe, expect, test } from 'vitest';

import { detectProvisionMode } from '../../../src/lib/provisioning/detect-provision-mode.js';
import { validateFlagCombinations } from '../../../src/lib/provisioning/validate-flag-combinations.js';

describe('detectProvisionMode', () => {
  test('detects manifest mode', () => {
    const mode = detectProvisionMode({ manifest: './setup.yaml', modules: undefined, scripts: undefined });
    expect(mode).toBe('manifest');
  });

  test('detects modules mode', () => {
    const mode = detectProvisionMode({ manifest: undefined, modules: './modules/', scripts: undefined });
    expect(mode).toBe('modules');
  });

  test('detects scripts mode', () => {
    const mode = detectProvisionMode({ manifest: undefined, modules: undefined, scripts: './scripts/' });
    expect(mode).toBe('scripts');
  });

  test('throws when no mode specified', () => {
    expect(() =>
      detectProvisionMode({ manifest: undefined, modules: undefined, scripts: undefined }),
    ).toThrow('One of --manifest, --modules, or --scripts is required.');
  });

  test('throws when multiple modes specified', () => {
    expect(() =>
      detectProvisionMode({ manifest: './setup.yaml', modules: './modules/', scripts: undefined }),
    ).toThrow('Only one of --manifest, --modules, or --scripts can be specified at a time.');
  });
});

describe('validateFlagCombinations', () => {
  test('allows assets with manifest mode', () => {
    expect(() =>
      { validateFlagCombinations('manifest', { assets: './dir', file: undefined, filter: undefined }); },
    ).not.toThrow();
  });

  test('rejects assets with modules mode', () => {
    expect(() =>
      { validateFlagCombinations('modules', { assets: './dir', file: undefined, filter: undefined }); },
    ).toThrow('--assets can only be used with --manifest mode.');
  });

  test('rejects file with scripts mode', () => {
    expect(() =>
      { validateFlagCombinations('scripts', { assets: undefined, file: ['./f.jar'], filter: undefined }); },
    ).toThrow('--file can only be used with --manifest mode.');
  });

  test('rejects filter without assets in manifest mode', () => {
    expect(() =>
      { validateFlagCombinations('manifest', { assets: undefined, file: undefined, filter: '*.jar' }); },
    ).toThrow('--filter requires --assets when used with --manifest mode.');
  });

  test('allows filter with assets in manifest mode', () => {
    expect(() =>
      { validateFlagCombinations('manifest', { assets: './dir', file: undefined, filter: '*.jar' }); },
    ).not.toThrow();
  });

  test('allows filter in modules mode', () => {
    expect(() =>
      { validateFlagCombinations('modules', { assets: undefined, file: undefined, filter: '*.jar' }); },
    ).not.toThrow();
  });
});
