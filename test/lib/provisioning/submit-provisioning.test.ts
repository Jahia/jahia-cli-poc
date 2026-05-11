import { describe, expect, test, vi, beforeEach } from 'vitest';

import { submitProvisioning } from '../../../src/lib/provisioning/submit-provisioning.js';

describe('submitProvisioning', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('returns success result on 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('Provisioning completed'),
      }),
    );

    const result = await submitProvisioning({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
      manifestContent: Buffer.from('install: []'),
      manifestFilename: 'setup.yaml',
      attachments: [],
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.message).toBe('Provisioning completed');
    expect(result.manifest).toBe('setup.yaml');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    vi.unstubAllGlobals();
  });

  test('returns failure result on 401 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }),
    );

    const result = await submitProvisioning({
      url: 'http://localhost:8080',
      username: 'wrong',
      password: 'wrong',
      manifestContent: Buffer.from('install: []'),
      manifestFilename: 'setup.yaml',
      attachments: [],
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.message).toBe('Unauthorized');

    vi.unstubAllGlobals();
  });

  test('handles network errors gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Connection refused')),
    );

    const result = await submitProvisioning({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
      manifestContent: Buffer.from('install: []'),
      manifestFilename: 'setup.yaml',
      attachments: [],
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
    expect(result.message).toBe('Connection refused');

    vi.unstubAllGlobals();
  });

  test('constructs correct endpoint URL with trailing slash', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await submitProvisioning({
      url: 'http://localhost:8080/',
      username: 'root',
      password: 'root1234',
      manifestContent: Buffer.from('test'),
      manifestFilename: 'test.yaml',
      attachments: [],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/modules/api/provisioning',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.unstubAllGlobals();
  });

  test('includes file attachments in form data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await submitProvisioning({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
      manifestContent: Buffer.from('install: []'),
      manifestFilename: 'setup.yaml',
      attachments: [
        { filename: 'module.jar', content: Buffer.from('jar-content') },
        { filename: 'content.zip', content: Buffer.from('zip-content') },
      ],
    });

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit] | undefined;
    expect(callArgs).toBeDefined();
    if (!callArgs) return;
    const body = callArgs[1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    // FormData should have script + 2 file entries
    const entries = [...body.entries()];
    expect(entries.filter(([key]) => key === 'script')).toHaveLength(1);
    expect(entries.filter(([key]) => key === 'file')).toHaveLength(2);

    vi.unstubAllGlobals();
  });
});
