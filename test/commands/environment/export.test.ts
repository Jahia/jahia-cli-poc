import { describe, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildExportJsonOutput, buildExportSuccessMessage } from '../../../src/commands/environment/export.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('buildExportSuccessMessage', () => {
  test('includes output path and environment name', () => {
    const msg = buildExportSuccessMessage({
      outputPath: './env.yml',
      environmentName: 'env-abc12345',
    });
    expect(msg).toContain('./env.yml');
    expect(msg).toContain('env-abc12345');
  });

  test('includes recreate hint with config flag', () => {
    const msg = buildExportSuccessMessage({
      outputPath: '/tmp/config.yml',
      environmentName: 'my-env',
    });
    expect(msg).toContain('jahia-cli environment create --config /tmp/config.yml');
  });
});

describe('buildExportJsonOutput', () => {
  test('returns valid JSON with expected fields', () => {
    const output = buildExportJsonOutput({
      config: {
        environment: {
          name: 'my-env',
          provider: 'docker',
          components: [{ name: 'jahia' }],
        },
      },
      yaml: 'environment:\n  name: my-env\n',
      outputPath: './env.yml',
      statePath: '/home/user/.jahia-cli/state.json',
    });
    const parsed = JSON.parse(output) as {
      success: boolean;
      outputPath: string;
      statePath: string;
      config: { environment: { name: string } };
      yaml: string;
    };
    expect(parsed.success).toBe(true);
    expect(parsed.outputPath).toBe('./env.yml');
    expect(parsed.statePath).toBe('/home/user/.jahia-cli/state.json');
    expect(parsed.config.environment.name).toBe('my-env');
    expect(parsed.yaml).toContain('environment:');
  });

  test('shows stdout when no output path', () => {
    const output = buildExportJsonOutput({
      config: { environment: { name: 'x', provider: 'docker', components: [] } },
      yaml: '',
      outputPath: undefined,
      statePath: '/tmp/state.json',
    });
    const parsed = JSON.parse(output) as { outputPath: string };
    expect(parsed.outputPath).toBe('stdout');
  });
});

describe('environment export command (integration)', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['environment', 'export', '--help']);
    expect(stdout).toContain('Export the active environment configuration');
    expect(stdout).toContain('--output');
    expect(stdout).toContain('--stdout');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--state');
  });

  test('errors when no --output or --stdout flag provided', async () => {
    try {
      await run(['environment', 'export', '--state', '/tmp/nonexistent-state.json']);
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      const err = error as { stderr: string };
      expect(err.stderr).toContain('--output');
    }
  });

  test('errors when no active environment exists', async () => {
    try {
      await run(['environment', 'export', '--stdout', '--state', '/tmp/nonexistent-state.json']);
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      const err = error as { stderr: string };
      expect(err.stderr).toContain('No active environment');
    }
  });
});
