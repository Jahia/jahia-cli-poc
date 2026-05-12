import { describe, expect, test, vi, beforeEach } from 'vitest';

import { fetchManifest } from '../../../src/lib/provisioning/fetch-manifest.js';

describe('fetchManifest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('downloads manifest and extracts filename from URL path', async () => {
    const content = 'install:\n  - module: test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(content).buffer),
      }),
    );

    const result = await fetchManifest('https://example.com/org/repo/provisioning.yaml');
    expect(result.filename).toBe('provisioning.yaml');
    expect(result.content.toString()).toBe(content);

    vi.unstubAllGlobals();
  });

  test('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    await expect(fetchManifest('https://example.com/missing.yaml')).rejects.toThrow(
      'Failed to download manifest',
    );

    vi.unstubAllGlobals();
  });

  test('uses fallback filename when URL path has no file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('content').buffer),
      }),
    );

    const result = await fetchManifest('https://example.com/');
    expect(result.filename).toBe('manifest.yaml');

    vi.unstubAllGlobals();
  });
});
