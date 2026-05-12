import { describe, expect, test } from 'vitest';

import {
  formatProvisioningResultHuman,
  loadAttachments,
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
