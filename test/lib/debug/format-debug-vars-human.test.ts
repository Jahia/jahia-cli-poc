import { describe, expect, test } from 'vitest';

import { formatDebugVarsHuman } from '../../../src/lib/debug/format-debug-vars-human.js';
import type { JcliEnvEntry } from '../../../src/lib/debug/types.js';

describe('formatDebugVarsHuman', () => {
  test('returns "none detected" message for empty entries', () => {
    const result = formatDebugVarsHuman([]);
    expect(result).toBe('  No JCLI_* environment variables detected.');
  });

  test('formats a single entry with singular "variable"', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_FOO', value: 'bar', isSecret: false },
    ];
    const result = formatDebugVarsHuman(entries);
    expect(result).toContain('JCLI_FOO');
    expect(result).toContain('= bar');
    expect(result).toContain('(1 variable detected)');
  });

  test('formats multiple entries with plural "variables"', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_A', value: 'alpha', isSecret: false },
      { key: 'JCLI_B', value: 'beta', isSecret: false },
    ];
    const result = formatDebugVarsHuman(entries);
    expect(result).toContain('(2 variables detected)');
  });

  test('aligns keys with padding', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_SHORT', value: 'x', isSecret: false },
      { key: 'JCLI_VERY_LONG_KEY', value: 'y', isSecret: false },
    ];
    const result = formatDebugVarsHuman(entries);
    const lines = result.split('\n');
    const firstEq = lines[0]?.indexOf('=') ?? -1;
    const secondEq = lines[1]?.indexOf('=') ?? -1;
    expect(firstEq).toBe(secondEq);
  });

  test('masks secret values', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_SECRET_TOKEN', value: 'mysecretvalue', isSecret: true },
    ];
    const result = formatDebugVarsHuman(entries);
    expect(result).toContain('my***ue');
    expect(result).not.toContain('mysecretvalue');
  });

  test('shows plain values for non-secrets', () => {
    const entries: readonly JcliEnvEntry[] = [
      { key: 'JCLI_SETTING', value: 'plaintext', isSecret: false },
    ];
    const result = formatDebugVarsHuman(entries);
    expect(result).toContain('plaintext');
  });
});
