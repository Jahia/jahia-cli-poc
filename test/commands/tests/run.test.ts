import { beforeEach, describe, expect, test, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

import {
  buildCypressComponent,
  formatRunStart,
  formatRunComplete,
} from '../../../src/commands/tests/run.js';

const execFileAsync = promisify(execFile);
const CLI = resolve('bin/dev.js');

const run = async (args: readonly string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync('node', [CLI, ...args], { timeout: 15_000 });

describe('tests run pure functions', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('formatRunStart', () => {
    test('includes image, network, and container name', () => {
      const msg = formatRunStart('jahia-tests:1.0', 'jahia-cli-env-abc', 'my-container');
      expect(msg).toContain('jahia-tests:1.0');
      expect(msg).toContain('jahia-cli-env-abc');
      expect(msg).toContain('my-container');
      expect(msg).toContain('▶');
    });
  });

  describe('formatRunComplete', () => {
    test('shows success for exit code 0', () => {
      const msg = formatRunComplete('test-container', 0);
      expect(msg).toContain('✓');
      expect(msg).toContain('passed');
      expect(msg).toContain('test-container');
    });

    test('shows failure for non-zero exit code', () => {
      const msg = formatRunComplete('test-container', 1);
      expect(msg).toContain('✗');
      expect(msg).toContain('failed');
      expect(msg).toContain('exit code 1');
    });

    test('includes container name for inspection hint', () => {
      const msg = formatRunComplete('my-cypress', 0);
      expect(msg).toContain('my-cypress');
      expect(msg).toContain('kept for inspection');
    });
  });

  describe('buildCypressComponent', () => {
    test('uses cypress component defaults', () => {
      vi.stubEnv('SUPER_USER_PASSWORD', 'test123');
      const component = buildCypressComponent([], undefined, undefined, {});
      expect(component.definition.name).toBe('cypress');
      expect(component.effectiveImage).toBe('jahia-tests');
      expect(component.effectiveEnv['JAHIA_URL']).toBe('http://jahia:8080');
      expect(component.effectiveEnv['SUPER_USER_PASSWORD']).toBe('test123');
    });

    test('applies image from container config', () => {
      const component = buildCypressComponent([], { image: 'my-custom-image', tag: 'v2' }, undefined, {});
      expect(component.effectiveImage).toBe('my-custom-image');
      expect(component.effectiveTag).toBe('v2');
    });

    test('falls back to scaffolding version for tag', () => {
      const component = buildCypressComponent([], undefined, '3.0.0', {});
      expect(component.effectiveTag).toBe('3.0.0');
    });

    test('merges user env overrides', () => {
      const component = buildCypressComponent([], undefined, undefined, {
        CYPRESS_SPEC: 'cypress/e2e/login.cy.ts',
      });
      expect(component.effectiveEnv['CYPRESS_SPEC']).toBe('cypress/e2e/login.cy.ts');
      expect(component.effectiveEnv['JAHIA_URL']).toBe('http://jahia:8080');
    });

    test('injects MAILPIT_URL when smtp-server is present', () => {
      const component = buildCypressComponent(['smtp-server'], undefined, undefined, {});
      expect(component.effectiveEnv['MAILPIT_URL']).toContain('smtp-server:8025');
    });

    test('does not inject MAILPIT_URL when smtp-server is absent', () => {
      const component = buildCypressComponent(['jahia'], undefined, undefined, {});
      expect(component.effectiveEnv['MAILPIT_URL']).toBeUndefined();
    });
  });
});

describe('tests run integration', () => {
  test('shows help output', async () => {
    const { stdout } = await run(['tests', 'run', '--help']);
    expect(stdout).toContain('tests run');
    expect(stdout).toContain('--config');
    expect(stdout).toContain('--state');
    expect(stdout).toContain('--env');
    expect(stdout).not.toContain('--tag');
  });
});
