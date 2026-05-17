import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  buildTestsInitFailureJson,
  buildTestsInitSuccessJson,
  formatTestsInitHuman,
  resolveScaffoldingConfig,
  formatSyncLine,
} from '../../../src/commands/tests/init.js';
import type { SyncMissingFilesResult } from '../../../src/lib/tests/types.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

const sampleResult: SyncMissingFilesResult = {
  entries: [
    { path: 'new/file.txt', action: 'copied', reason: 'imported from remote' },
    { path: 'existing/file.txt', action: 'kept', reason: 'already exists locally' },
    { path: '.gitignore', action: 'ignored', reason: 'excluded by policy' },
  ],
  copied: ['new/file.txt'],
  kept: ['existing/file.txt'],
  ignored: ['.gitignore'],
  overwritten: [],
};

describe('resolveScaffoldingConfig', () => {
  test('returns defaults when scaffolding is undefined', () => {
    const result = resolveScaffoldingConfig(undefined);
    expect(result.repository).toBe('https://github.com/Jahia/jahia-cypress');
    expect(result.path).toBe('scaffolding/');
    expect(result.version).toBe('latest');
  });

  test('preserves provided values', () => {
    const result = resolveScaffoldingConfig({
      repository: 'https://example.com/repo',
      path: 'src/',
      version: 'v1.0.0',
    });
    expect(result.repository).toBe('https://example.com/repo');
    expect(result.path).toBe('src/');
    expect(result.version).toBe('v1.0.0');
  });
});

describe('formatSyncLine', () => {
  test('formats a copied line', () => {
    const line = formatSyncLine('copied', 'package.json', 'imported from remote');
    expect(line).toContain('SYNC:');
    expect(line).toContain('package.json');
    expect(line).toContain('imported from remote');
  });

  test('formats a kept line', () => {
    const line = formatSyncLine('kept', 'existing.ts', 'already exists locally');
    expect(line).toContain('SKIP:');
    expect(line).toContain('existing.ts');
  });

  test('formats an ignored line', () => {
    const line = formatSyncLine('ignored', '.gitignore', 'excluded by policy');
    expect(line).toContain('IGNORED:');
    expect(line).toContain('.gitignore');
  });

  test('formats an overwritten line', () => {
    const line = formatSyncLine('overwritten', 'package.json', 'overwritten (managed by scaffolding)');
    expect(line).toContain('FORCE:');
    expect(line).toContain('package.json');
    expect(line).toContain('overwritten (managed by scaffolding)');
  });
});

describe('tests init output formatters', () => {
  test('formats human output summary', () => {
    const output = formatTestsInitHuman({
      version: 'test-jahia-cli',
      destinationPath: '/tmp/tests',
      repositoryUrl: 'https://github.com/Jahia/jahia-cypress.git',
      scaffoldingPath: 'scaffolding/',
      result: sampleResult,
      configFile: '/tmp/tests/config.yml',
      configCreated: true,
      gitignoreEntriesAdded: 1,
      logLines: ['  SYNC:    new/file.txt (imported from remote)'],
    });
    expect(output).toContain('Test scaffolding initialized');
    expect(output).toContain('1 synced');
    expect(output).toContain('0 overwritten');
    expect(output).toContain('1 skipped');
    expect(output).toContain('1 ignored');
  });

  test('builds success JSON output', () => {
    const parsed = JSON.parse(
      buildTestsInitSuccessJson({
        version: 'v2.0.0',
        destinationPath: '/tmp/tests',
        repositoryUrl: 'https://github.com/Jahia/jahia-cypress.git',
        scaffoldingPath: 'scaffolding/',
        result: sampleResult,
        configFile: '/tmp/tests/config.yml',
        configCreated: false,
        gitignoreEntriesAdded: 1,
      }),
    ) as Record<string, unknown>;
    expect(parsed['success']).toBe(true);
    expect(parsed['version']).toBe('v2.0.0');
    expect(parsed['synced']).toEqual(['new/file.txt']);
    expect(parsed['overwritten']).toEqual([]);
    expect(parsed['skipped']).toEqual(['existing/file.txt']);
    expect(parsed['ignored']).toEqual(['.gitignore']);
    expect(parsed['gitignoreUpdated']).toBe(true);
    expect(parsed['configCreated']).toBe(false);
  });

  test('builds failure JSON output', () => {
    const parsed = JSON.parse(
      buildTestsInitFailureJson({
        destinationPath: '/tmp/tests',
        message: 'boom',
      }),
    ) as Record<string, unknown>;
    expect(parsed['success']).toBe(false);
    expect(parsed['error']).toBe('tests_init_failed');
    expect(parsed['message']).toBe('boom');
  });
});

describe('tests init command', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['tests', 'init', '--help']);
    expect(stdout).toContain('Initialize local test scaffolding');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--force');
  });
});
