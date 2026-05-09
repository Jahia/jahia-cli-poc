import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

import {
  buildWorkflowInitSuccessMessage,
  loadExistingConfigForWorkflow,
} from '../../../src/commands/workflow/init.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('workflow init unit tests', () => {
  describe('loadExistingConfigForWorkflow', () => {
    test('returns empty config for non-existent file', async () => {
      const config = await loadExistingConfigForWorkflow('/tmp/nonexistent.yml');
      expect(config).toEqual({});
    });

    test('loads existing config from file', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
      const filePath = join(dir, 'config.yml');
      await writeFile(
        filePath,
        yaml.dump({ environment: { components: ['jahia'] } }),
        'utf-8',
      );

      try {
        const config = await loadExistingConfigForWorkflow(filePath);
        expect(config.environment).toBeDefined();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe('buildWorkflowInitSuccessMessage', () => {
    test('includes file path and run hint', () => {
      const msg = buildWorkflowInitSuccessMessage('config.yml');
      expect(msg).toContain('config.yml');
      expect(msg).toContain('workflow run');
    });
  });
});

describe('workflow init integration tests', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['workflow', 'init', '--help']);
    expect(stdout).toContain('workflow');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--force');
  });

  test('creates workflow section in config file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');

    try {
      await run(['workflow', 'init', '--config', outputFile]);
      const content = await readFile(outputFile, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;
      const workflow = parsed['workflow'] as Record<string, unknown>;

      expect(workflow).toBeDefined();
      expect(Array.isArray(workflow['steps'])).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('preserves existing environment section', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');
    await writeFile(
      outputFile,
      yaml.dump({
        environment: { provider: 'docker', components: ['jahia'] },
      }),
      'utf-8',
    );

    try {
      await run(['workflow', 'init', '--config', outputFile]);
      const content = await readFile(outputFile, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;

      expect(parsed['environment']).toBeDefined();
      expect(parsed['workflow']).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('refuses to overwrite without --force', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');
    await writeFile(
      outputFile,
      yaml.dump({
        workflow: { steps: [{ run: 'echo existing' }] },
      }),
      'utf-8',
    );

    try {
      await expect(
        run(['workflow', 'init', '--config', outputFile]),
      ).rejects.toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('overwrites workflow with --force', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');
    await writeFile(
      outputFile,
      yaml.dump({
        workflow: { steps: [{ run: 'echo old' }] },
      }),
      'utf-8',
    );

    try {
      await run(['workflow', 'init', '--config', outputFile, '--force']);
      const content = await readFile(outputFile, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;
      const workflow = parsed['workflow'] as Record<string, unknown>;
      const steps = workflow['steps'] as unknown[];

      expect(steps.length).toBeGreaterThan(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('outputs JSON when --json flag is used', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
    const outputFile = join(dir, 'config.yml');

    try {
      const { stdout } = await run(['workflow', 'init', '--config', outputFile, '--json']);
      const parsed = JSON.parse(stdout) as { success: boolean; workflow: unknown };
      expect(parsed.success).toBe(true);
      expect(parsed.workflow).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
