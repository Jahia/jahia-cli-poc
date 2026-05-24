import { describe, expect, test } from 'vitest';

import { buildDebugJson } from '../../../src/lib/debug/build-debug-json.js';
import type { JcliEnvEntry } from '../../../src/lib/debug/types.js';

describe('buildDebugJson', () => {
  test('returns empty structure for no entries', () => {
    const result = buildDebugJson([]);
    expect(result).toEqual({ variables: [], count: 0 });
  });

  test('includes count matching number of entries', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_A', value: 'a', isSecret: false },
      { key: 'JCLI_B', value: 'b', isSecret: false },
    ];
    const result = buildDebugJson(entries);
    expect(result.count).toBe(2);
  });

  test('masks secret values in output', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_SECRET_KEY', value: 'topsecret', isSecret: true },
    ];
    const result = buildDebugJson(entries);
    expect(result.variables[0]?.value).toBe('to***et');
    expect(result.variables[0]?.masked).toBe(true);
  });

  test('preserves plain values for non-secrets', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_SETTING', value: 'myvalue', isSecret: false },
    ];
    const result = buildDebugJson(entries);
    expect(result.variables[0]?.value).toBe('myvalue');
    expect(result.variables[0]?.masked).toBe(false);
  });

  test('handles mixed secret and non-secret entries', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_NORMAL', value: 'visible', isSecret: false },
      { key: 'JCLI_SECRET_PASS', value: 'hidden123', isSecret: true },
    ];
    const result = buildDebugJson(entries);
    expect(result.variables[0]?.value).toBe('visible');
    expect(result.variables[0]?.masked).toBe(false);
    expect(result.variables[1]?.value).toBe('hi***23');
    expect(result.variables[1]?.masked).toBe(true);
  });
});
