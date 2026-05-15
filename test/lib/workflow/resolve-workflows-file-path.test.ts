import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  DEFAULT_WORKFLOWS_FILENAME,
  resolveWorkflowsFilePath,
} from '../../../src/lib/workflow/resolve-workflows-file-path.js';

describe('resolveWorkflowsFilePath', () => {
  test('returns default file in CWD when neither flag nor config key provided', () => {
    const result = resolveWorkflowsFilePath('/config/dir', undefined, undefined);
    expect(result.path).toBe(resolve(DEFAULT_WORKFLOWS_FILENAME));
    expect(result.isExplicit).toBe(false);
  });

  test('resolves flag value relative to CWD', () => {
    const result = resolveWorkflowsFilePath('/config/dir', undefined, 'workflows.yml');
    expect(result.path).toBe(resolve('workflows.yml'));
    expect(result.isExplicit).toBe(true);
  });

  test('resolves config key relative to config directory', () => {
    const result = resolveWorkflowsFilePath('/config/dir', 'workflows.yml', undefined);
    expect(result.path).toBe(resolve('/config/dir', 'workflows.yml'));
    expect(result.isExplicit).toBe(true);
  });

  test('flag takes precedence over config key', () => {
    const result = resolveWorkflowsFilePath('/config/dir', 'from-config.yml', 'from-flag.yml');
    expect(result.path).toBe(resolve('from-flag.yml'));
    expect(result.isExplicit).toBe(true);
  });

  test('handles absolute flag path', () => {
    const absPath = resolve('/absolute/workflows.yml');
    const result = resolveWorkflowsFilePath('/config/dir', undefined, absPath);
    expect(result.path).toBe(absPath);
    expect(result.isExplicit).toBe(true);
  });

  test('default filename is jahia-cli.workflows.global.yml', () => {
    expect(DEFAULT_WORKFLOWS_FILENAME).toBe('jahia-cli.workflows.global.yml');
  });
});
