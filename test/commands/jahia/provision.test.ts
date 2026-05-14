import { describe, expect, test } from 'vitest';

import {
  detectProvisionMode,
  formatFileActionResult,
  formatProvisioningResultHuman,
  loadAttachments,
  validateFlagCombinations,
} from '../../../src/commands/jahia/provision.js';

describe('formatProvisioningResultHuman', () => {
  test('formats success result', () => {
    const output = formatProvisioningResultHuman({
      success: true,
      statusCode: 200,
      message: 'OK',
      responseBody: undefined,
      manifest: 'setup.yaml',
      durationMs: 1234,
    });
    expect(output).toContain('✓');
    expect(output).toContain('Provisioning succeeded');
    expect(output).toContain('setup.yaml');
    expect(output).toContain('1234ms');
  });

  test('formats failure result with error message', () => {
    const output = formatProvisioningResultHuman({
      success: false,
      statusCode: 500,
      message: 'Internal Server Error',
      responseBody: undefined,
      manifest: 'setup.yaml',
      durationMs: 500,
    });
    expect(output).toContain('✗');
    expect(output).toContain('Provisioning failed');
    expect(output).toContain('Internal Server Error');
  });

  test('formats JSON response body as pretty-printed JSON', () => {
    const output = formatProvisioningResultHuman({
      success: true,
      statusCode: 200,
      message: '[]',
      responseBody: [
        { addMavenRepository: 'https://example.com/repo', status: 'success' },
      ],
      manifest: 'setup.yaml',
      durationMs: 2000,
    });
    expect(output).toContain('Provisioning succeeded');
    expect(output).toContain('"addMavenRepository"');
    expect(output).toContain('"success"');
  });
});

describe('loadAttachments', () => {
  test('returns empty array for no files', async () => {
    const result = await loadAttachments([]);
    expect(result).toEqual([]);
  });
});

describe('formatFileActionResult', () => {
  test('formats success result', () => {
    const output = formatFileActionResult({
      success: true,
      statusCode: 200,
      message: 'OK',
      responseBody: undefined,
      filename: 'module.jar',
      durationMs: 300,
    });
    expect(output).toContain('✓');
    expect(output).toContain('module.jar');
    expect(output).toContain('succeeded');
    expect(output).toContain('300ms');
  });

  test('formats failure result', () => {
    const output = formatFileActionResult({
      success: false,
      statusCode: 500,
      message: 'Error',
      responseBody: undefined,
      filename: 'broken.jar',
      durationMs: 100,
    });
    expect(output).toContain('✗');
    expect(output).toContain('broken.jar');
    expect(output).toContain('failed');
  });
});

describe('detectProvisionMode', () => {
  test('detects manifest mode', () => {
    expect(detectProvisionMode({ manifest: 'setup.yaml', modules: undefined, scripts: undefined }))
      .toBe('manifest');
  });

  test('detects modules mode', () => {
    expect(detectProvisionMode({ manifest: undefined, modules: './mods', scripts: undefined }))
      .toBe('modules');
  });

  test('detects scripts mode', () => {
    expect(detectProvisionMode({ manifest: undefined, modules: undefined, scripts: './scripts' }))
      .toBe('scripts');
  });

  test('throws when no mode specified', () => {
    expect(() => detectProvisionMode({ manifest: undefined, modules: undefined, scripts: undefined }))
      .toThrow('One of --manifest, --modules, or --scripts is required.');
  });

  test('throws when multiple modes specified', () => {
    expect(() => detectProvisionMode({ manifest: 'setup.yaml', modules: './mods', scripts: undefined }))
      .toThrow('Only one of --manifest, --modules, or --scripts can be specified at a time.');
  });
});

describe('validateFlagCombinations', () => {
  test('allows manifest with assets', () => {
    expect(() => { validateFlagCombinations('manifest', { assets: './dir', file: undefined, filter: undefined }); })
      .not.toThrow();
  });

  test('allows manifest with assets and filter', () => {
    expect(() => { validateFlagCombinations('manifest', { assets: './dir', file: undefined, filter: '*.jar' }); })
      .not.toThrow();
  });

  test('allows modules with filter', () => {
    expect(() => { validateFlagCombinations('modules', { assets: undefined, file: undefined, filter: '*.jar' }); })
      .not.toThrow();
  });

  test('allows scripts with filter', () => {
    expect(() => { validateFlagCombinations('scripts', { assets: undefined, file: undefined, filter: '*.groovy' }); })
      .not.toThrow();
  });

  test('rejects assets with modules mode', () => {
    expect(() => { validateFlagCombinations('modules', { assets: './dir', file: undefined, filter: undefined }); })
      .toThrow('--assets can only be used with --manifest mode.');
  });

  test('rejects file with scripts mode', () => {
    expect(() => { validateFlagCombinations('scripts', { assets: undefined, file: ['mod.jar'], filter: undefined }); })
      .toThrow('--file can only be used with --manifest mode.');
  });

  test('rejects filter with manifest when no assets', () => {
    expect(() => { validateFlagCombinations('manifest', { assets: undefined, file: undefined, filter: '*.jar' }); })
      .toThrow('--filter requires --assets when used with --manifest mode.');
  });
});
