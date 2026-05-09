import { describe, expect, test } from 'vitest';

import { buildFlagsFromWith, getStepDisplayName } from '../../../src/lib/workflow/types.js';

describe('getStepDisplayName', () => {
  test('returns step name when provided', () => {
    expect(getStepDisplayName({ name: 'My Step', run: 'echo' }, 0)).toBe('My Step');
  });

  test('returns uses command when no name', () => {
    expect(getStepDisplayName({ uses: 'environment:create' }, 0)).toBe('environment:create');
  });

  test('returns run command when no name and no uses', () => {
    expect(getStepDisplayName({ run: 'npm test' }, 0)).toBe('npm test');
  });

  test('returns fallback with index when no name, uses, or run', () => {
    expect(getStepDisplayName({}, 2)).toBe('Step 3');
  });
});

describe('buildFlagsFromWith', () => {
  test('returns empty array for undefined', () => {
    expect(buildFlagsFromWith(undefined)).toEqual([]);
  });

  test('converts key-value pairs to CLI flags', () => {
    expect(buildFlagsFromWith({ timeout: '300', verbose: 'true' })).toEqual([
      '--timeout',
      '300',
      '--verbose',
    ]);
  });

  test('returns empty array for empty record', () => {
    expect(buildFlagsFromWith({})).toEqual([]);
  });

  test('emits bare flag for true boolean values', () => {
    expect(buildFlagsFromWith({ force: 'true' })).toEqual(['--force']);
  });

  test('omits flag for false boolean values', () => {
    expect(buildFlagsFromWith({ force: 'false' })).toEqual([]);
  });

  test('handles mix of boolean and string values', () => {
    expect(buildFlagsFromWith({ force: 'true', timeout: '60', debug: 'false' })).toEqual([
      '--force',
      '--timeout',
      '60',
    ]);
  });
});
