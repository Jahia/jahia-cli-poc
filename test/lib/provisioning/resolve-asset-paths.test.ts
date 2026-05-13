import { describe, expect, test } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveAssetPaths } from '../../../src/lib/provisioning/resolve-asset-paths.js';

describe('resolveAssetPaths', () => {
  const tempDirRef: { current: string } = { current: '' };

  test('returns all files in a directory recursively', async () => {
    tempDirRef.current = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const subDir = join(tempDirRef.current, 'sub');
    await mkdir(subDir);
    await writeFile(join(tempDirRef.current, 'a.jar'), 'content-a');
    await writeFile(join(subDir, 'b.jar'), 'content-b');

    const result = await resolveAssetPaths(tempDirRef.current);
    const filenames = result.map((p) => basename(p));
    expect(filenames).toContain('a.jar');
    expect(filenames).toContain('b.jar');
    expect(result).toHaveLength(2);

    await rm(tempDirRef.current, { recursive: true, force: true });
  });

  test('returns single file when path is a file', async () => {
    tempDirRef.current = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const filePath = join(tempDirRef.current, 'single.jar');
    await writeFile(filePath, 'content');

    const result = await resolveAssetPaths(filePath);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('single.jar');

    await rm(tempDirRef.current, { recursive: true, force: true });
  });

  test('returns empty array for empty directory', async () => {
    tempDirRef.current = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));

    const result = await resolveAssetPaths(tempDirRef.current);
    expect(result).toHaveLength(0);

    await rm(tempDirRef.current, { recursive: true, force: true });
  });
});
