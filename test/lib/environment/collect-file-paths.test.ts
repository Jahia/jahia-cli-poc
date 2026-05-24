import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, test, expect, afterEach } from 'vitest';

import { collectFilePaths } from '../../../src/lib/environment/collect-file-paths.js';

describe('collectFilePaths', () => {
  const tempBase = join(tmpdir(), 'jahia-cli-collect-');
  const dirs: string[] = [];

  const createTempDir = async (): Promise<string> => {
    const dir = await mkdtemp(tempBase);
    dirs.push(dir);
    return dir;
  };

  afterEach(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
    dirs.length = 0;
  });

  test('returns empty array for empty directory', async () => {
    const base = await createTempDir();
    const dir = join(base, 'environment');
    await mkdir(dir);

    const result = await collectFilePaths(dir, base);
    expect(result).toEqual([]);
  });

  test('collects files with portable relative paths', async () => {
    const base = await createTempDir();
    const dir = join(base, 'environment');
    await mkdir(dir);
    await writeFile(join(dir, 'docker-compose.yml'), 'version: "3"');

    const result = await collectFilePaths(dir, base);
    expect(result).toContain('environment/docker-compose.yml');
  });

  test('collects files recursively in subdirectories', async () => {
    const base = await createTempDir();
    const dir = join(base, 'environment');
    const servicesDir = join(dir, 'services');
    await mkdir(servicesDir, { recursive: true });
    await writeFile(join(dir, 'docker-compose.yml'), 'version: "3"');
    await writeFile(join(servicesDir, 'jahia.yml'), 'services:');
    await writeFile(join(servicesDir, 'config.yml'), 'groups:');

    const result = await collectFilePaths(dir, base);
    expect(result).toHaveLength(3);
    expect(result).toContain('environment/docker-compose.yml');
    expect(result).toContain('environment/services/jahia.yml');
    expect(result).toContain('environment/services/config.yml');
  });

  test('handles deeply nested directories', async () => {
    const base = await createTempDir();
    const deep = join(base, 'environment', 'a', 'b', 'c');
    await mkdir(deep, { recursive: true });
    await writeFile(join(deep, 'file.txt'), 'content');

    const result = await collectFilePaths(join(base, 'environment'), base);
    expect(result).toContain('environment/a/b/c/file.txt');
  });
});
