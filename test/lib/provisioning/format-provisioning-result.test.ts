import { describe, expect, test } from 'vitest';

import {
  formatProvisioningResultHuman,
  formatFileActionResult,
} from '../../../src/lib/provisioning/format-provisioning-result.js';

describe('formatProvisioningResultHuman', () => {
  test('formats successful result', () => {
    const output = formatProvisioningResultHuman({
      success: true,
      statusCode: 200,
      message: 'OK',
      responseBody: undefined,
      manifest: 'setup.yaml',
      durationMs: 1234,
    });

    expect(output).toContain('✓ Provisioning succeeded');
    expect(output).toContain('setup.yaml');
    expect(output).toContain('HTTP 200');
    expect(output).toContain('1234ms');
  });

  test('formats failed result with error message', () => {
    const output = formatProvisioningResultHuman({
      success: false,
      statusCode: 500,
      message: 'Internal error',
      responseBody: undefined,
      manifest: 'bad.yaml',
      durationMs: 456,
    });

    expect(output).toContain('✗ Provisioning failed');
    expect(output).toContain('Internal error');
  });

  test('includes response body when present', () => {
    const output = formatProvisioningResultHuman({
      success: true,
      statusCode: 200,
      message: 'OK',
      responseBody: { result: 'done' },
      manifest: 'setup.yaml',
      durationMs: 100,
    });

    expect(output).toContain('"result": "done"');
  });
});

describe('formatFileActionResult', () => {
  test('formats successful file action', () => {
    const output = formatFileActionResult({
      filename: 'module.jar',
      success: true,
      statusCode: 200,
      durationMs: 567,
    });

    expect(output).toContain('✓');
    expect(output).toContain('module.jar');
    expect(output).toContain('succeeded');
    expect(output).toContain('HTTP 200');
    expect(output).toContain('567ms');
  });

  test('formats failed file action', () => {
    const output = formatFileActionResult({
      filename: 'bad.jar',
      success: false,
      statusCode: 500,
      durationMs: 100,
    });

    expect(output).toContain('✗');
    expect(output).toContain('failed');
  });
});
