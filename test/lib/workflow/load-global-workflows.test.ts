import { writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import yaml from 'js-yaml';

import { loadGlobalWorkflows } from '../../../src/lib/workflow/load-global-workflows.js';

const testDir = join(tmpdir(), 'jahia-cli-test-global-workflows');

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('loadGlobalWorkflows', () => {
  test('returns found=false for missing file', async () => {
    const result = await loadGlobalWorkflows(join(testDir, 'nonexistent.yml'));
    expect(result.found).toBe(false);
    expect(result.workflows).toBeUndefined();
  });

  test('loads valid global workflows file', async () => {
    const filePath = join(testDir, 'valid.yml');
    const content = yaml.dump({
      workflows: {
        setup: { steps: [{ run: 'echo setup' }] },
        test: { default: true, steps: [{ run: 'echo test' }] },
      },
    });
    await writeFile(filePath, content, 'utf-8');

    const result = await loadGlobalWorkflows(filePath);
    expect(result.found).toBe(true);
    expect(result.workflows).toBeDefined();
    expect(Object.keys(result.workflows ?? {})).toEqual(['setup', 'test']);
    expect(result.workflows?.['test']?.default).toBe(true);
  });

  test('returns error for file without workflows key', async () => {
    const filePath = join(testDir, 'no-workflows-key.yml');
    await writeFile(filePath, 'foo: bar\n', 'utf-8');

    const result = await loadGlobalWorkflows(filePath);
    expect(result.found).toBe(true);
    expect(result.workflows).toBeUndefined();
    expect(result.error).toContain('workflows:');
  });

  test('returns error for non-object YAML', async () => {
    const filePath = join(testDir, 'scalar.yml');
    await writeFile(filePath, 'just a string\n', 'utf-8');

    const result = await loadGlobalWorkflows(filePath);
    expect(result.found).toBe(true);
    expect(result.workflows).toBeUndefined();
    expect(result.error).toContain('YAML object');
  });

  test('throws for permission errors (not ENOENT)', async () => {
    // Passing a directory as a file path triggers an EISDIR error on most systems
    await expect(loadGlobalWorkflows(testDir)).rejects.toThrow();
  });
});
