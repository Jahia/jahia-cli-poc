import { describe, expect, test, beforeEach, afterEach } from 'vitest';

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

  describe('env var substitution in with values', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('resolves ${VAR} patterns in values', () => {
      process.env['JAHIA_URL'] = 'http://jahia:8080';
      expect(buildFlagsFromWith({ url: '${JAHIA_URL}' })).toEqual([
        '--url',
        'http://jahia:8080',
      ]);
    });

    test('resolves ${VAR:-default} patterns with fallback', () => {
      delete process.env['JAHIA_URL'];
      expect(buildFlagsFromWith({ url: '${JAHIA_URL:-http://localhost:8080}' })).toEqual([
        '--url',
        'http://localhost:8080',
      ]);
    });

    test('resolves env var that evaluates to true as boolean flag', () => {
      process.env['FORCE_FLAG'] = 'true';
      expect(buildFlagsFromWith({ force: '${FORCE_FLAG}' })).toEqual(['--force']);
    });

    test('resolves env var that evaluates to false by omitting flag', () => {
      process.env['DEBUG_FLAG'] = 'false';
      expect(buildFlagsFromWith({ debug: '${DEBUG_FLAG}' })).toEqual([]);
    });
  });
});
