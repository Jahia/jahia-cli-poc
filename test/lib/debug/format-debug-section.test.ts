import { describe, expect, test } from 'vitest';

import { formatDebugSection } from '../../../src/lib/debug/format-debug-section.js';

describe('formatDebugSection', () => {
  test('wraps content with header and blank lines', () => {
    const content = '  JCLI_FOO = bar';
    const result = formatDebugSection(content);
    expect(result).toContain('── Debug: JCLI Environment ──');
    expect(result).toContain(content);
  });

  test('starts with a blank line', () => {
    const result = formatDebugSection('  content');
    expect(result.startsWith('\n')).toBe(true);
  });

  test('ends with a blank line', () => {
    const result = formatDebugSection('  content');
    expect(result.endsWith('\n')).toBe(true);
  });

  test('includes header on second line', () => {
    const result = formatDebugSection('  content');
    const lines = result.split('\n');
    expect(lines[1]).toBe('  ── Debug: JCLI Environment ──');
  });
});
