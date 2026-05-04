import { describe, test, expect, vi, beforeEach } from 'vitest';
import { querySamStatus } from '../../../src/lib/sam/query-sam-status.js';

const makeFetchResponse = (ok: boolean, status: number, body: unknown): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    json: () => Promise.resolve(body),
  }) as unknown as Response;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('querySamStatus', () => {
  test('returns GREEN health on valid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse(true, 200, {
          data: { admin: { jahia: { healthCheck: { status: { health: 'GREEN', message: 'All good' } } } } },
        }),
      ),
    );
    const result = await querySamStatus('http://localhost:8080', 'root', 'root1234', 'MEDIUM');
    expect(result.health).toBe('GREEN');
    expect(result.message).toBe('All good');
  });

  test('builds correct endpoint for URL without trailing slash', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse(true, 200, {
        data: { admin: { jahia: { healthCheck: { status: { health: 'GREEN', message: '' } } } } },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
    await querySamStatus('http://localhost:8080', 'root', 'root1234', 'MEDIUM');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/modules/graphql',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('builds correct endpoint for URL with trailing slash', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse(true, 200, {
        data: { admin: { jahia: { healthCheck: { status: { health: 'GREEN', message: '' } } } } },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
    await querySamStatus('http://localhost:8080/', 'root', 'root1234', 'MEDIUM');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/modules/graphql',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('sends Origin header matching the base URL (no trailing slash)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse(true, 200, {
        data: { admin: { jahia: { healthCheck: { status: { health: 'GREEN', message: '' } } } } },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
    await querySamStatus('http://localhost:8080/', 'root', 'root1234', 'MEDIUM');
    const headers = (mockFetch.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
    expect(headers.headers['Origin']).toBe('http://localhost:8080');
  });

  test('returns UNREACHABLE on non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(false, 404, {})));
    const result = await querySamStatus('http://localhost:8080', 'root', 'root1234', 'MEDIUM');
    expect(result.health).toBe('UNREACHABLE');
    expect(result.message).toContain('404');
  });

  test('returns ERROR on GraphQL errors in response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse(true, 200, {
          errors: [{ message: 'Permission denied' }],
          data: null,
        }),
      ),
    );
    const result = await querySamStatus('http://localhost:8080', 'root', 'root1234', 'MEDIUM');
    expect(result.health).toBe('ERROR');
    expect(result.message).toContain('Permission denied');
  });

  test('returns UNREACHABLE when status is missing from response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse(true, 200, { data: { admin: {} } })),
    );
    const result = await querySamStatus('http://localhost:8080', 'root', 'root1234', 'MEDIUM');
    expect(result.health).toBe('UNREACHABLE');
    expect(result.message).toBe('No health status in response');
  });

  test('returns UNREACHABLE when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
    const result = await querySamStatus('http://localhost:8080', 'root', 'root1234', 'MEDIUM');
    expect(result.health).toBe('UNREACHABLE');
    expect(result.message).toBe('Connection refused');
  });

  test('returns UNREACHABLE when fetch throws non-Error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('network error string'));
    const result = await querySamStatus('http://localhost:8080', 'root', 'root1234', 'MEDIUM');
    expect(result.health).toBe('UNREACHABLE');
    expect(result.message).toBe('network error string');
  });
});
