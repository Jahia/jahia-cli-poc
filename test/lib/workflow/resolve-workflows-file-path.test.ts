import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { resolveWorkflowsFilePath } from '../../../src/lib/workflow/resolve-workflows-file-path.js';

describe('resolveWorkflowsFilePath', () => {
  test('returns undefined when neither flag nor config key provided', () => {
    expect(resolveWorkflowsFilePath('/config/dir', undefined, undefined)).toBeUndefined();
  });

  test('resolves flag value relative to CWD', () => {
    const result = resolveWorkflowsFilePath('/config/dir', undefined, 'global.yml');
    expect(result).toBe(resolve('global.yml'));
  });

  test('resolves config key relative to config directory', () => {
    const result = resolveWorkflowsFilePath('/config/dir', 'global.yml', undefined);
    expect(result).toBe(resolve('/config/dir', 'global.yml'));
  });

  test('flag takes precedence over config key', () => {
    const result = resolveWorkflowsFilePath('/config/dir', 'from-config.yml', 'from-flag.yml');
    expect(result).toBe(resolve('from-flag.yml'));
  });

  test('handles absolute flag path', () => {
    const absPath = resolve('/absolute/global.yml');
    const result = resolveWorkflowsFilePath('/config/dir', undefined, absPath);
    expect(result).toBe(absPath);
  });
});
