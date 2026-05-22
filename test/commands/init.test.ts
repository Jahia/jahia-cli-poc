import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assembleConfig,
  buildInitSuccessMessage,
} from '../../src/commands/init.js';
import type { EnvironmentConfig, ScaffoldingConfig } from '../../src/lib/config/types.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('init command unit tests', () => {
  describe('assembleConfig', () => {
    const scaffolding: ScaffoldingConfig = {
      repository: 'https://github.com/Jahia/jahia-cypress',
      path: 'scaffolding/',
      version: 'latest',
    };

    const environment: EnvironmentConfig = {
      name: 'test-env',
      provider: 'docker',
      composePath: './environment/docker-compose.yml',
    };

    test('assembles all three sections', () => {
      const config = assembleConfig(scaffolding, environment);
      expect(config.scaffolding).toBe(scaffolding);
      expect(config.environment).toBe(environment);
      expect(config.workflows).toBeDefined();
      const mainWorkflow = config.workflows?.['main'];
      expect(mainWorkflow).toBeDefined();
      expect(mainWorkflow?.steps.length).toBeGreaterThan(0);
    });

    test('includes sample workflows with both run and uses steps', () => {
      const config = assembleConfig(scaffolding, environment);
      const mainWorkflow = config.workflows?.['main'];
      const hasRun = mainWorkflow?.steps.some((step) => step.run !== undefined);
      const hasUses = mainWorkflow?.steps.some((step) => step.uses !== undefined);
      expect(hasRun).toBe(true);
      expect(hasUses).toBe(true);
    });
  });

  describe('buildInitSuccessMessage', () => {
    test('includes config path', () => {
      const msg = buildInitSuccessMessage('/workspace/config.yml', '/workspace/environment/docker-compose.yml');
      expect(msg).toContain('/workspace/config.yml');
    });

    test('includes compose path and next steps', () => {
      const msg = buildInitSuccessMessage('config.yml', 'environment/docker-compose.yml');
      expect(msg).toContain('environment/docker-compose.yml');
      expect(msg).toContain('environment create');
      expect(msg).toContain('docker compose -f environment/docker-compose.yml up -d');
    });

    test('includes success checkmark', () => {
      const msg = buildInitSuccessMessage('config.yml', 'environment/docker-compose.yml');
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
