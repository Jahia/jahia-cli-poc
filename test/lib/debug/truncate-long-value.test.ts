import { describe, expect, test } from 'vitest';

import { truncateLongValue } from '../../../src/lib/debug/truncate-long-value.js';

describe('truncateLongValue', () => {
  test('returns short values unchanged', () => {
    expect(truncateLongValue('hello')).toBe('hello');
  });

  test('returns exactly 200-char values unchanged', () => {
    const value = 'a'.repeat(200);
    expect(truncateLongValue(value)).toBe(value);
  });

  test('truncates values longer than 200 characters', () => {
    const value = 'a'.repeat(300);
    const result = truncateLongValue(value);
    expect(result.length).toBe(200);
    expect(result).toContain('***REDACTED***');
  });

  test('preserves beginning and end of long values', () => {
    const prefix = 'START_';
    const suffix = '_END';
    const value = prefix + 'x'.repeat(300) + suffix;
    const result = truncateLongValue(value);
    expect(result.startsWith('START_')).toBe(true);
    expect(result.endsWith('_END')).toBe(true);
  });

  test('returns [EMPTY] for empty string', () => {
    expect(truncateLongValue('')).toBe('[EMPTY]');
  });

  test('result length is exactly 200 for any input over 200', () => {
    const value = 'b'.repeat(500);
    const result = truncateLongValue(value);
    expect(result.length).toBe(200);
  });
});
