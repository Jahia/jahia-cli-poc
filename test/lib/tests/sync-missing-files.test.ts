import { describe, expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { syncMissingFiles } from '../../../src/lib/tests/sync-missing-files.js';

const writeTextFile = async (filePath: string, content: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
};

describe('syncMissingFiles', () => {
  test('copies missing files recursively when destination is empty', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, 'package.json'), '{"name":"tests"}');
      await writeTextFile(join(sourceDir, 'nested', 'ci.startup.sh'), '#!/bin/sh');

      const result = await syncMissingFiles({ sourceDir, destinationDir });

      expect(result.copied).toEqual(['nested/ci.startup.sh', 'package.json']);
      expect(result.kept).toEqual([]);
      expect(await readFile(join(destinationDir, 'package.json'), 'utf-8')).toBe(
        '{"name":"tests"}',
      );
      expect(await readFile(join(destinationDir, 'nested', 'ci.startup.sh'), 'utf-8')).toBe(
        '#!/bin/sh',
      );
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('keeps local file when same path exists in destination', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, 'package.json'), '{"name":"from-scaffolding"}');
      await writeTextFile(join(destinationDir, 'package.json'), '{"name":"local"}');

      const result = await syncMissingFiles({ sourceDir, destinationDir });

      expect(result.copied).toEqual([]);
      expect(result.kept).toEqual(['package.json']);
      expect(await readFile(join(destinationDir, 'package.json'), 'utf-8')).toBe(
        '{"name":"local"}',
      );
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('returns mixed copied and kept files with deterministic ordering', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, 'a.txt'), 'a');
      await writeTextFile(join(sourceDir, 'b.txt'), 'b-from-scaffolding');
      await writeTextFile(join(sourceDir, 'nested', 'c.txt'), 'c');
      await writeTextFile(join(destinationDir, 'b.txt'), 'b-local');

      const result = await syncMissingFiles({ sourceDir, destinationDir });

      expect(result.copied).toEqual(['a.txt', 'nested/c.txt']);
      expect(result.kept).toEqual(['b.txt']);
      expect(result.entries).toEqual([
        { path: 'a.txt', action: 'copied' },
        { path: 'b.txt', action: 'kept' },
        { path: 'nested/c.txt', action: 'copied' },
      ]);
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('handles empty source directory', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      const result = await syncMissingFiles({ sourceDir, destinationDir });
      expect(result.entries).toEqual([]);
      expect(result.copied).toEqual([]);
      expect(result.kept).toEqual([]);
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });
});
