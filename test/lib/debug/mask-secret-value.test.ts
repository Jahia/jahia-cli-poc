import { describe, expect, test } from 'vitest';

import { maskSecretValue } from '../../../src/lib/debug/mask-secret-value.js';

describe('maskSecretValue', () => {
  test('masks empty string as [EMPTY]', () => {
    expect(maskSecretValue('')).toBe('[EMPTY]');
  });

  test('masks single character as ****', () => {
    expect(maskSecretValue('a')).toBe('****');
  });

  test('masks 2 characters as ****', () => {
    expect(maskSecretValue('ab')).toBe('****');
  });

  test('masks 3 characters as ****', () => {
    expect(maskSecretValue('abc')).toBe('****');
  });

  test('masks exactly 4 characters as ****', () => {
    expect(maskSecretValue('abcd')).toBe('****');
  });

  test('masks 5 characters showing first 2 and last 2', () => {
    expect(maskSecretValue('abcde')).toBe('ab***de');
  });

  test('masks long strings showing first 2 and last 2', () => {
    expect(maskSecretValue('mysecretpassword')).toBe('my***rd');
  });

  test('masks exactly 6 characters correctly', () => {
    expect(maskSecretValue('secret')).toBe('se***et');
  });
});
