import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assembleConfig,
  buildInitSuccessMessage,
} from '../../src/commands/init.js';
import type { EnvironmentConfig, TestsConfig } from '../../src/lib/config/types.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('init command unit tests', () => {
  describe('assembleConfig', () => {
    const environment: EnvironmentConfig = {
      name: 'test-env',
      provider: 'docker',
      components: [{ name: 'jahia' }],
    };

    const tests: TestsConfig = {
      scaffolding: {
        repository: 'https://github.com/Jahia/jahia-cypress',
        path: 'scaffolding/',
        version: 'latest',
      },
    };

    test('assembles all three sections', () => {
      const config = assembleConfig(environment, tests);
      expect(config.environment).toBe(environment);
      expect(config.tests).toBe(tests);
      expect(config.workflows).toBeDefined();
      const mainWorkflow = config.workflows?.['main'];
      expect(mainWorkflow).toBeDefined();
      expect(mainWorkflow?.steps.length).toBeGreaterThan(0);
    });

    test('includes sample workflows with both run and uses steps', () => {
      const config = assembleConfig(environment, tests);
      const mainWorkflow = config.workflows?.['main'];
      const hasRun = mainWorkflow?.steps.some((s) => s.run !== undefined);
      const hasUses = mainWorkflow?.steps.some((s) => s.uses !== undefined);
      expect(hasRun).toBe(true);
      expect(hasUses).toBe(true);
    });
  });

  describe('buildInitSuccessMessage', () => {
    test('includes config path', () => {
      const msg = buildInitSuccessMessage('/tmp/config.yml');
      expect(msg).toContain('/tmp/config.yml');
    });

    test('includes next steps', () => {
      const msg = buildInitSuccessMessage('config.yml');
      expect(msg).toContain('environment create');
      expect(msg).toContain('workflow run');
    });

    test('includes success checkmark', () => {
      const msg = buildInitSuccessMessage('config.yml');
      expect(msg).toContain('✓');
    });
  });
});

describe('init command integration tests', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['init', '--help']);
    expect(stdout).toContain('Interactive onboarding wizard');
    expect(stdout).toContain('--json');
  });
});
