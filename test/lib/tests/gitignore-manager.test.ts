import { describe, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildManagedSection,
  extractManagedEntries,
  replaceManagedSection,
  updateGitignore,
} from '../../../src/lib/tests/gitignore-manager.js';

describe('buildManagedSection', () => {
  test('builds a section with sorted entries and markers', () => {
    const result = buildManagedSection(['cypress/support/e2e.ts', 'package.json', 'cypress.config.ts']);
    expect(result).toContain('# --- jahia-cli:managed-start ---');
    expect(result).toContain('# --- jahia-cli:managed-end ---');
    expect(result).toContain('cypress.config.ts');
    // Should be sorted alphabetically
    const lines = result.split('\n');
    const entryLines = lines.filter((l) => !l.startsWith('#'));
    expect(entryLines).toEqual([...entryLines].sort());
  });

  test('includes header explaining purpose', () => {
    const result = buildManagedSection(['file.ts']);
    expect(result).toContain('managed by jahia-cli tests init');
    expect(result).toContain('Remove a line to "own" that file');
  });
});

describe('replaceManagedSection', () => {
  test('appends managed section to empty content', () => {
    const result = replaceManagedSection('', ['file.ts']);
    expect(result).toContain('# --- jahia-cli:managed-start ---');
    expect(result).toContain('file.ts');
    expect(result).toContain('# --- jahia-cli:managed-end ---');
  });

  test('appends managed section after existing content', () => {
    const existing = 'node_modules/\ndist/\n';
    const result = replaceManagedSection(existing, ['file.ts']);
    expect(result).toMatch(/^node_modules\/\ndist\/\n/);
    expect(result).toContain('file.ts');
  });

  test('replaces existing managed section without duplicating', () => {
    const existing = [
      'node_modules/',
      '# --- jahia-cli:managed-start ---',
      '# old content',
      'old-file.ts',
      '# --- jahia-cli:managed-end ---',
      'dist/',
    ].join('\n');

    const result = replaceManagedSection(existing, ['new-file.ts']);
    expect(result).not.toContain('old-file.ts');
    expect(result).toContain('new-file.ts');
    expect(result).toContain('node_modules/');
    expect(result).toContain('dist/');
    // Only one managed section
    const startCount = (result.match(/jahia-cli:managed-start/g) ?? []).length;
    expect(startCount).toBe(1);
  });

  test('handles content without trailing newline', () => {
    const result = replaceManagedSection('node_modules/', ['file.ts']);
    expect(result).toContain('node_modules/');
    expect(result).toContain('file.ts');
  });
});

describe('extractManagedEntries', () => {
  test('extracts entries from managed section', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-gitignore-'));
    const gitignorePath = join(dir, '.gitignore');

    try {
      await updateGitignore(gitignorePath, ['file1.ts', 'nested/file2.ts']);
      const entries = await extractManagedEntries(gitignorePath);

      expect(entries.has('file1.ts')).toBe(true);
      expect(entries.has('nested/file2.ts')).toBe(true);
      expect(entries.size).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('returns empty set when file does not exist', async () => {
    const entries = await extractManagedEntries('/nonexistent/.gitignore');
    expect(entries.size).toBe(0);
  });

  test('returns empty set when no managed section exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-gitignore-'));
    const gitignorePath = join(dir, '.gitignore');
    await writeFile(gitignorePath, 'node_modules/\ndist/\n', 'utf-8');

    try {
      const entries = await extractManagedEntries(gitignorePath);
      expect(entries.size).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('updateGitignore', () => {
  test('creates .gitignore when it does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-gitignore-'));
    const gitignorePath = join(dir, '.gitignore');

    try {
      const result = await updateGitignore(gitignorePath, ['file.ts', 'other.ts']);
      expect(result.created).toBe(true);
      expect(result.entriesAdded).toBe(2);

      const content = await readFile(gitignorePath, 'utf-8');
      expect(content).toContain('file.ts');
      expect(content).toContain('other.ts');
      expect(content).toContain('# --- jahia-cli:managed-start ---');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('updates existing .gitignore preserving user content', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-gitignore-'));
    const gitignorePath = join(dir, '.gitignore');
    await writeFile(gitignorePath, 'node_modules/\ndist/\n', 'utf-8');

    try {
      const result = await updateGitignore(gitignorePath, ['synced.ts']);
      expect(result.created).toBe(false);
      expect(result.entriesAdded).toBe(1);

      const content = await readFile(gitignorePath, 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('dist/');
      expect(content).toContain('synced.ts');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('is idempotent on re-run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-gitignore-'));
    const gitignorePath = join(dir, '.gitignore');

    try {
      await updateGitignore(gitignorePath, ['file1.ts', 'file2.ts']);
      await updateGitignore(gitignorePath, ['file1.ts', 'file2.ts', 'file3.ts']);

      const content = await readFile(gitignorePath, 'utf-8');
      const startCount = (content.match(/jahia-cli:managed-start/g) ?? []).length;
      expect(startCount).toBe(1);
      expect(content).toContain('file3.ts');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
