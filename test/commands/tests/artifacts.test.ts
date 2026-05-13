import { describe, expect, test } from 'vitest';

import {
  buildCollectionJson,
  formatCollectionHuman,
  formatComponentResult,
} from '../../../src/commands/tests/artifacts.js';
import type { CollectionResult, ComponentCollectionResult } from '../../../src/lib/artifacts/types.js';

const sampleComponent: ComponentCollectionResult = {
  componentName: 'jahia',
  containerId: 'abc123',
  logFile: 'jahia.log',
  logSource: 'victorialogs',
  logError: undefined,
  artifacts: [
    { path: '/var/log/jahia/jahia-error', success: true },
  ],
};

const failedComponent: ComponentCollectionResult = {
  componentName: 'smtp-server',
  containerId: 'def456',
  logFile: undefined,
  logSource: undefined,
  logError: 'Connection refused',
  artifacts: [
    { path: '/tmp/mail.log', success: false, error: 'No such file' },
  ],
};

const sampleResult: CollectionResult = {
  envName: 'test-env',
  outputDir: '/tmp/results',
  components: [sampleComponent, failedComponent],
};

describe('formatComponentResult', () => {
  test('formats a successful component', () => {
    const output = formatComponentResult(sampleComponent);
    expect(output).toContain('jahia');
    expect(output).toContain('✓ jahia.log');
    expect(output).toContain('victorialogs');
    expect(output).toContain('✓ /var/log/jahia/jahia-error');
  });

  test('formats a failed component', () => {
    const output = formatComponentResult(failedComponent);
    expect(output).toContain('smtp-server');
    expect(output).toContain('✗ logs failed');
    expect(output).toContain('Connection refused');
    expect(output).toContain('✗ /tmp/mail.log');
    expect(output).toContain('No such file');
  });
});

describe('formatCollectionHuman', () => {
  test('includes environment name and output dir', () => {
    const output = formatCollectionHuman(sampleResult);
    expect(output).toContain('test-env');
    expect(output).toContain('/tmp/results');
  });

  test('includes all component results', () => {
    const output = formatCollectionHuman(sampleResult);
    expect(output).toContain('jahia');
    expect(output).toContain('smtp-server');
  });
});

describe('buildCollectionJson', () => {
  test('returns valid JSON with success: true', () => {
    const json = buildCollectionJson(sampleResult);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['success']).toBe(true);
    expect(parsed['envName']).toBe('test-env');
  });

  test('includes all components', () => {
    const json = buildCollectionJson(sampleResult);
    const parsed = JSON.parse(json) as { components: unknown[] };
    expect(parsed.components).toHaveLength(2);
  });

  test('converts undefined errors to null in JSON', () => {
    const json = buildCollectionJson(sampleResult);
    const parsed = JSON.parse(json) as { components: { logError: unknown }[] };
    expect(parsed.components[0]?.logError).toBeNull();
    expect(parsed.components[1]?.logError).toBe('Connection refused');
  });
});
