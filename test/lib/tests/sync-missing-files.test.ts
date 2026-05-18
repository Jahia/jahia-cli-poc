import { describe, expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { syncMissingFiles } from '../../../src/lib/tests/sync-missing-files.js';
import type { SyncAction } from '../../../src/lib/tests/types.js';

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
      expect(result.ignored).toEqual([]);
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
      expect(result.ignored).toEqual([]);
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('excludes files matching exclusion patterns', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, '.gitignore'), 'node_modules/');
      await writeTextFile(join(sourceDir, 'package.json'), '{}');
      await writeTextFile(join(sourceDir, 'sub', '.gitattributes'), '* text=auto');

      const result = await syncMissingFiles({ sourceDir, destinationDir });

      expect(result.copied).toEqual(['package.json']);
      expect(result.ignored).toEqual(['.gitignore', 'sub/.gitattributes']);
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('invokes logger callback for each file decision', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, '.gitignore'), 'ignored');
      await writeTextFile(join(sourceDir, 'new.txt'), 'new');
      await writeTextFile(join(sourceDir, 'existing.txt'), 'remote');
      await writeTextFile(join(destinationDir, 'existing.txt'), 'local');

      const logged: { action: SyncAction; path: string; reason: string }[] = [];
      await syncMissingFiles({
        sourceDir,
        destinationDir,
        logger: (action, path, reason) => {
          logged.push({ action, path, reason });
        },
      });

      expect(logged).toContainEqual({ action: 'ignored', path: '.gitignore', reason: 'excluded by policy' });
      expect(logged).toContainEqual({ action: 'copied', path: 'new.txt', reason: 'imported from remote' });
      expect(logged).toContainEqual({ action: 'kept', path: 'existing.txt', reason: 'already exists locally' });
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('respects custom exclusion patterns', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, 'keep.txt'), 'keep');
      await writeTextFile(join(sourceDir, 'skip.md'), 'skip');

      const result = await syncMissingFiles({
        sourceDir,
        destinationDir,
        exclusionPatterns: ['skip.md'],
      });

      expect(result.copied).toEqual(['keep.txt']);
      expect(result.ignored).toEqual(['skip.md']);
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('overwrites managed files when force is true', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, 'managed.txt'), 'new-version');
      await writeTextFile(join(sourceDir, 'local.txt'), 'new-version');
      await writeTextFile(join(destinationDir, 'managed.txt'), 'old-version');
      await writeTextFile(join(destinationDir, 'local.txt'), 'local-version');

      const managedPaths = new Set(['managed.txt']);
      const result = await syncMissingFiles({
        sourceDir,
        destinationDir,
        force: true,
        managedPaths,
      });

      expect(result.overwritten).toEqual(['managed.txt']);
      expect(result.kept).toEqual(['local.txt']);
      expect(await readFile(join(destinationDir, 'managed.txt'), 'utf-8')).toBe('new-version');
      expect(await readFile(join(destinationDir, 'local.txt'), 'utf-8')).toBe('local-version');
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });

  test('does not overwrite when force is false even if file is managed', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'jahia-cli-source-'));
    const destinationDir = await mkdtemp(join(tmpdir(), 'jahia-cli-dest-'));

    try {
      await writeTextFile(join(sourceDir, 'managed.txt'), 'new-version');
      await writeTextFile(join(destinationDir, 'managed.txt'), 'old-version');

      const managedPaths = new Set(['managed.txt']);
      const result = await syncMissingFiles({
        sourceDir,
        destinationDir,
        force: false,
        managedPaths,
      });

      expect(result.kept).toEqual(['managed.txt']);
      expect(result.overwritten).toEqual([]);
      expect(await readFile(join(destinationDir, 'managed.txt'), 'utf-8')).toBe('old-version');
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
      await rm(destinationDir, { recursive: true, force: true });
    }
  });
});
