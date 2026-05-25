import { describe, expect, test } from 'vitest';

import { collectJcliVars } from '../../../src/lib/debug/collect-jcli-vars.js';

describe('collectJcliVars', () => {
  test('returns empty array for empty env', () => {
    expect(collectJcliVars({})).toEqual([]);
  });

  test('returns empty array when no matching prefix vars exist', () => {
    expect(collectJcliVars({ HOME: '/home/user', PATH: '/usr/bin' })).toEqual([]);
  });

  test('collects only variables matching the default J_ prefix', () => {
    const env = {
      J_FOO: 'bar',
      HOME: '/home/user',
      J_BAZ: 'qux',
      OTHER: 'value',
    };
    const result = collectJcliVars(env);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.key)).toEqual(['J_BAZ', 'J_FOO']);
  });

  test('collects variables matching a custom prefix', () => {
    const env = {
      MYAPP_FOO: 'bar',
      MYAPP_BAZ: 'qux',
      J_OTHER: 'value',
    };
    const result = collectJcliVars(env, 'MYAPP_');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.key)).toEqual(['MYAPP_BAZ', 'MYAPP_FOO']);
  });

  test('sorts variables alphabetically by key', () => {
    const env = {
      J_ZEBRA: 'z',
      J_ALPHA: 'a',
      J_MIDDLE: 'm',
    };
    const result = collectJcliVars(env);
    expect(result.map((e) => e.key)).toEqual(['J_ALPHA', 'J_MIDDLE', 'J_ZEBRA']);
  });

  test('marks variables containing sensitive keywords as secrets', () => {
    const env = {
      J_NORMAL: 'value',
      J_PASSWORD: 'supersecret',
      J_DB_TOKEN: 'abc123',
      J_USERNAME: 'admin',
    };
    const result = collectJcliVars(env);
    const normal = result.find((e) => e.key === 'J_NORMAL');
    const password = result.find((e) => e.key === 'J_PASSWORD');
    const token = result.find((e) => e.key === 'J_DB_TOKEN');
    const username = result.find((e) => e.key === 'J_USERNAME');
    expect(normal?.isSecret).toBe(false);
    expect(password?.isSecret).toBe(true);
    expect(token?.isSecret).toBe(true);
    expect(username?.isSecret).toBe(true);
  });

  test('keyword matching is case-insensitive', () => {
    const env = {
      J_MY_PASSWORD_HERE: 'sec1',
      J_ApiKey_Value: 'sec2',
      J_CREDENTIAL_FILE: 'sec3',
    };
    const result = collectJcliVars(env);
    expect(result.every((e) => e.isSecret)).toBe(true);
  });

  test('filters out undefined values', () => {
    const env: Record<string, string | undefined> = {
      J_DEFINED: 'yes',
      J_UNDEFINED: undefined,
    };
    const result = collectJcliVars(env);
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('J_DEFINED');
  });

  test('does not mark non-sensitive variables as secrets', () => {
    const env = { J_DEBUG: 'true', J_JAHIA_VERSION: '8.2' };
    const result = collectJcliVars(env);
    expect(result).toHaveLength(2);
    expect(result.every((e) => !e.isSecret)).toBe(true);
  });
});
