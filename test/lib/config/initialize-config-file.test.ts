import { describe, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';

import { buildBlankConfig } from '../../../src/lib/config/build-blank-config.js';
import { initializeConfigFile } from '../../../src/lib/config/initialize-config-file.js';
import { withTestsVersion } from '../../../src/lib/config/with-tests-version.js';

describe('initializeConfigFile', () => {
  test('writes config file when output does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');

    try {
      const result = await initializeConfigFile({
        outputFile,
        config: withTestsVersion(buildBlankConfig(), 'v2.0.0'),
        force: false,
      });

      expect(result.written).toBe(true);
      const parsed = yaml.load(await readFile(outputFile, 'utf-8')) as Record<string, unknown>;
      const tests = parsed['tests'] as Record<string, unknown>;
      expect(tests['jahia-cypress']).toBe('v2.0.0');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('returns written=false when file exists and force=false', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');

    try {
      await writeFile(outputFile, 'name: existing\n', 'utf-8');

      const result = await initializeConfigFile({
        outputFile,
        config: buildBlankConfig(),
        force: false,
      });

      expect(result.written).toBe(false);
      expect(await readFile(outputFile, 'utf-8')).toBe('name: existing\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('overwrites existing file when force=true', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');

    try {
      await writeFile(outputFile, 'name: existing\n', 'utf-8');

      const result = await initializeConfigFile({
        outputFile,
        config: withTestsVersion(buildBlankConfig(), 'v3.0.0'),
        force: true,
      });

      expect(result.written).toBe(true);
      const parsed = yaml.load(await readFile(outputFile, 'utf-8')) as Record<string, unknown>;
      const tests = parsed['tests'] as Record<string, unknown>;
      expect(tests['jahia-cypress']).toBe('v3.0.0');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
