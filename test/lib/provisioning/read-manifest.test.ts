import { join } from 'node:path';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, test, beforeEach, afterEach } from 'vitest';

import { readManifest } from '../../../src/lib/provisioning/read-manifest.js';

describe('readManifest', () => {
  const tempDirRef: { current: string } = { current: '' };

  beforeEach(async () => {
    tempDirRef.current = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
  });

  afterEach(async () => {
    await rm(tempDirRef.current, { recursive: true, force: true });
  });

  test('reads file content and extracts basename', async () => {
    const filePath = join(tempDirRef.current, 'setup.yaml');
    await writeFile(filePath, 'install:\n  - module: my-module');
    const result = await readManifest(filePath);
    expect(result.filename).toBe('setup.yaml');
    expect(result.content.toString()).toBe('install:\n  - module: my-module');
  });

  test('handles nested path and returns only basename', async () => {
    const filePath = join(tempDirRef.current, 'provisioning.yml');
    await writeFile(filePath, 'content');
    const result = await readManifest(filePath);
    expect(result.filename).toBe('provisioning.yml');
  });

  test('throws when file does not exist', async () => {
    await expect(readManifest(join(tempDirRef.current, 'nonexistent.yaml'))).rejects.toThrow();
  });
});
