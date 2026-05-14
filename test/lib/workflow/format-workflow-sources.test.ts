import { describe, expect, test } from 'vitest';

import {
  buildWorkflowSourcesJson,
  formatAvailableWorkflows,
  formatWorkflowSources,
} from '../../../src/lib/workflow/format-workflow-sources.js';
import type { MergedWorkflowsResult } from '../../../src/lib/workflow/merge-workflow-sources.js';

describe('formatWorkflowSources', () => {
  test('formats local-only sources', () => {
    const output = formatWorkflowSources('/path/config.yml', 2, undefined);
    expect(output).toContain('Workflow sources:');
    expect(output).toContain('Local config: /path/config.yml (2 workflows)');
  });

  test('formats with global file loaded', () => {
    const output = formatWorkflowSources('/path/config.yml', 1, {
      found: true,
      path: '/path/global.yml',
      workflows: { setup: { steps: [{ run: 'echo' }] } },
    });
    expect(output).toContain('✓ Global file:');
    expect(output).toContain('1 workflows loaded');
  });

  test('formats with missing global file', () => {
    const output = formatWorkflowSources('/path/config.yml', 1, {
      found: false,
      path: '/path/missing.yml',
      workflows: undefined,
    });
    expect(output).toContain('⚠ Global file:');
    expect(output).toContain('file not found, skipping');
  });

  test('formats with global file error', () => {
    const output = formatWorkflowSources('/path/config.yml', 0, {
      found: true,
      path: '/path/bad.yml',
      workflows: undefined,
      error: 'Missing workflows key',
    });
    expect(output).toContain('⚠ Global file:');
    expect(output).toContain('Missing workflows key');
  });

  test('shows zero local workflows', () => {
    const output = formatWorkflowSources('/path/config.yml', 0, undefined);
    expect(output).toContain('no workflows');
  });
});

describe('formatAvailableWorkflows', () => {
  const merged: MergedWorkflowsResult = {
    workflows: {
      setup: { steps: [{ run: 'echo setup' }] },
      main: { default: true, steps: [{ run: 'echo main' }] },
      cleanup: { steps: [{ run: 'echo cleanup' }] },
    },
    sources: {
      setup: 'global',
      main: 'local',
      cleanup: 'local-override',
    },
  };

  test('shows all workflows with source labels', () => {
    const output = formatAvailableWorkflows(merged, 'main');
    expect(output).toContain('Available workflows:');
    expect(output).toContain('setup');
    expect(output).toContain('(global)');
    expect(output).toContain('main');
    expect(output).toContain('(local, default)');
    expect(output).toContain('cleanup');
    expect(output).toContain('(local, overrides global)');
  });

  test('marks selected workflow with arrow', () => {
    const output = formatAvailableWorkflows(merged, 'main');
    expect(output).toContain('→ main');
    expect(output).toContain('← selected');
  });

  test('marks different selected workflow', () => {
    const output = formatAvailableWorkflows(merged, 'setup');
    expect(output).toContain('→ setup');
  });
});

describe('buildWorkflowSourcesJson', () => {
  const merged: MergedWorkflowsResult = {
    workflows: {
      setup: { steps: [{ run: 'echo' }] },
      main: { default: true, steps: [{ run: 'echo' }] },
    },
    sources: { setup: 'global', main: 'local' },
  };

  test('builds structured JSON with sources', () => {
    const json = buildWorkflowSourcesJson(
      '/path/config.yml',
      { main: { default: true, steps: [{ run: 'echo' }] } },
      { found: true, path: '/path/global.yml', workflows: { setup: { steps: [{ run: 'echo' }] } } },
      merged,
      'main',
    );
    const sources = json['sources'] as Record<string, unknown>;
    expect(sources['local']).toEqual({ path: '/path/config.yml', workflowCount: 1 });
    const globalSource = sources['global'] as Record<string, unknown>;
    expect(globalSource['found']).toBe(true);
    expect(globalSource['workflowCount']).toBe(1);
    expect(json['selectedWorkflow']).toBe('main');
    expect(json['availableWorkflows']).toHaveLength(2);
  });

  test('omits global section when no global file', () => {
    const json = buildWorkflowSourcesJson(
      '/path/config.yml',
      { main: { default: true, steps: [{ run: 'echo' }] } },
      undefined,
      merged,
      'main',
    );
    const sources = json['sources'] as Record<string, unknown>;
    expect(sources['global']).toBeUndefined();
  });
});
