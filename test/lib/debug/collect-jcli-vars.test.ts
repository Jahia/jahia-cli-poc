import { describe, expect, test } from 'vitest';

import { collectJcliVars } from '../../../src/lib/debug/collect-jcli-vars.js';

describe('collectJcliVars', () => {
  test('returns empty array for empty env', () => {
    expect(collectJcliVars({})).toEqual([]);
  });

  test('returns empty array when no JCLI_ vars exist', () => {
    expect(collectJcliVars({ HOME: '/home/user', PATH: '/usr/bin' })).toEqual([]);
  });

  test('collects only JCLI_-prefixed variables', () => {
    const env = {
      JCLI_FOO: 'bar',
      HOME: '/home/user',
      JCLI_BAZ: 'qux',
      OTHER: 'value',
    };
    const result = collectJcliVars(env);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.key)).toEqual(['JCLI_BAZ', 'JCLI_FOO']);
  });

  test('sorts variables alphabetically by key', () => {
    const env = {
      JCLI_ZEBRA: 'z',
      JCLI_ALPHA: 'a',
      JCLI_MIDDLE: 'm',
    };
    const result = collectJcliVars(env);
    expect(result.map((e) => e.key)).toEqual(['JCLI_ALPHA', 'JCLI_MIDDLE', 'JCLI_ZEBRA']);
  });

  test('marks JCLI_SECRET_ prefixed vars as secrets', () => {
    const env = {
      JCLI_NORMAL: 'value',
      JCLI_SECRET_TOKEN: 'supersecret',
    };
    const result = collectJcliVars(env);
    expect(result[0]?.isSecret).toBe(false);
    expect(result[1]?.isSecret).toBe(true);
  });

  test('filters out undefined values', () => {
    const env: Record<string, string | undefined> = {
      JCLI_DEFINED: 'yes',
      JCLI_UNDEFINED: undefined,
    };
    const result = collectJcliVars(env);
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('JCLI_DEFINED');
  });

  test('includes JCLI_DEBUG itself in results', () => {
    const env = { JCLI_DEBUG: 'true' };
    const result = collectJcliVars(env);
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('JCLI_DEBUG');
    expect(result[0]?.isSecret).toBe(false);
  });
});
