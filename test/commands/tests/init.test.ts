import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  buildTestsInitFailureJson,
  buildTestsInitSuccessJson,
  formatTestsInitHuman,
} from '../../../src/commands/tests/init.js';
import type { SyncMissingFilesResult } from '../../../src/lib/tests/types.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

const sampleResult: SyncMissingFilesResult = {
  entries: [
    { path: 'new/file.txt', action: 'copied' },
    { path: 'existing/file.txt', action: 'kept' },
  ],
  copied: ['new/file.txt'],
  kept: ['existing/file.txt'],
};

describe('tests init output formatters', () => {
  test('formats human output summary', () => {
    const output = formatTestsInitHuman({
      version: 'test-jahia-cli',
      destinationPath: '/tmp/tests',
      repositoryUrl: 'https://github.com/Jahia/jahia-cypress.git',
      result: sampleResult,
      configFile: '/tmp/tests/config.yml',
      configCreated: true,
    });
    expect(output).toContain('Test scaffolding initialized');
    expect(output).toContain('Copied:       1');
    expect(output).toContain('Kept:         1');
    expect(output).toContain('Config:       /tmp/tests/config.yml (created)');
  });

  test('builds success JSON output', () => {
    const parsed = JSON.parse(
      buildTestsInitSuccessJson({
        requestedVersion: undefined,
        version: 'v2.0.0',
        destinationPath: '/tmp/tests',
        repositoryUrl: 'https://github.com/Jahia/jahia-cypress.git',
        result: sampleResult,
        configFile: '/tmp/tests/config.yml',
        configCreated: false,
      }),
    ) as Record<string, unknown>;
    expect(parsed['success']).toBe(true);
    expect(parsed['version']).toBe('v2.0.0');
    expect(parsed['copiedCount']).toBe(1);
    expect(parsed['keptCount']).toBe(1);
    expect(parsed['configCreated']).toBe(false);
  });

  test('builds failure JSON output', () => {
    const parsed = JSON.parse(
      buildTestsInitFailureJson({
        requestedVersion: 'main',
        destinationPath: '/tmp/tests',
        message: 'boom',
      }),
    ) as Record<string, unknown>;
    expect(parsed['success']).toBe(false);
    expect(parsed['error']).toBe('tests_init_failed');
    expect(parsed['requestedVersion']).toBe('main');
  });
});

describe('tests init command', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['tests', 'init', '--help']);
    expect(stdout).toContain('Initialize local test scaffolding from jahia-cypress');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--path');
  });
});
