import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SamPollEvent } from '../../../src/lib/sam/types.js';

vi.mock('../../../src/lib/sam/query-sam-status.js', () => ({
  querySamStatus: vi.fn(),
}));

import { waitForSam } from '../../../src/lib/sam/wait-for-sam.js';
import { querySamStatus } from '../../../src/lib/sam/query-sam-status.js';

const mockQuery = vi.mocked(querySamStatus);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('waitForSam', () => {
  test('resolves immediately when consecutive GREEN count is met', async () => {
    mockQuery.mockResolvedValue({ health: 'GREEN', message: 'All good' });

    const promise = waitForSam({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
      severity: 'MEDIUM',
      intervalSeconds: 0,
      timeoutSeconds: 30,
      consecutiveCount: 3,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.consecutiveGreen).toBe(3);
    expect(result.lastHealth).toBe('GREEN');
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  test('resets consecutive count on non-GREEN response', async () => {
    mockQuery
      .mockResolvedValueOnce({ health: 'GREEN', message: '' })
      .mockResolvedValueOnce({ health: 'RED', message: 'Starting' })
      .mockResolvedValueOnce({ health: 'GREEN', message: '' })
      .mockResolvedValueOnce({ health: 'GREEN', message: '' });

    const promise = waitForSam({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
      severity: 'MEDIUM',
      intervalSeconds: 0,
      timeoutSeconds: 30,
      consecutiveCount: 2,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.consecutiveGreen).toBe(2);
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  test('rejects on timeout before reaching consecutive count', async () => {
    mockQuery.mockResolvedValue({ health: 'RED', message: 'Not ready' });

    // Attach rejection handler immediately (inline) to prevent unhandled-rejection warning
    // when step() throws synchronously on timeoutSeconds: 0
    await expect(
      waitForSam({
        url: 'http://localhost:8080',
        username: 'root',
        password: 'root1234',
        severity: 'MEDIUM',
        intervalSeconds: 0,
        timeoutSeconds: 0,
        consecutiveCount: 3,
      }),
    ).rejects.toThrow(/Timeout/);
  });

  test('emits poll events via onPoll callback', async () => {
    mockQuery
      .mockResolvedValueOnce({ health: 'YELLOW', message: 'Loading' })
      .mockResolvedValueOnce({ health: 'GREEN', message: 'Ready' });

    const events: SamPollEvent[] = [];

    const promise = waitForSam({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
      severity: 'MEDIUM',
      intervalSeconds: 0,
      timeoutSeconds: 30,
      consecutiveCount: 1,
      onPoll: (event) => {
        events.push(event);
      },
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(events).toHaveLength(2);
    expect(events[0]?.health).toBe('YELLOW');
    expect(events[0]?.consecutiveGreen).toBe(0);
    expect(events[1]?.health).toBe('GREEN');
    expect(events[1]?.consecutiveGreen).toBe(1);
  });

  test('handles UNREACHABLE responses without throwing', async () => {
    mockQuery
      .mockResolvedValueOnce({ health: 'UNREACHABLE', message: 'Connection refused' })
      .mockResolvedValueOnce({ health: 'GREEN', message: '' });

    const promise = waitForSam({
      url: 'http://localhost:8080',
      username: 'root',
      password: 'root1234',
      severity: 'MEDIUM',
      intervalSeconds: 0,
      timeoutSeconds: 30,
      consecutiveCount: 1,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.consecutiveGreen).toBe(1);
  });
});
