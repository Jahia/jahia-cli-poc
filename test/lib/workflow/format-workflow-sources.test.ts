import { describe, expect, test } from 'vitest';

import {
  buildWorkflowSourcesJson,
  formatAvailableWorkflows,
  formatWorkflowSources,
} from '../../../src/lib/workflow/format-workflow-sources.js';
import type { MergedWorkflowsResult } from '../../../src/lib/workflow/merge-workflow-sources.js';

describe('formatWorkflowSources', () => {
  test('formats config-only sources', () => {
    const output = formatWorkflowSources('/path/config.yml', 2, undefined);
    expect(output).toContain('Workflow sources:');
    expect(output).toContain('Config:');
    expect(output).toContain('/path/config.yml (2 workflows)');
  });

  test('formats with workflow file loaded', () => {
    const output = formatWorkflowSources('/path/config.yml', 1, {
      found: true,
      path: '/path/workflows.yml',
      workflows: { setup: { steps: [{ run: 'echo' }] } },
    });
    expect(output).toContain('✓ Workflow file:');
    expect(output).toContain('1 workflows loaded');
  });

  test('formats with missing workflow file', () => {
    const output = formatWorkflowSources('/path/config.yml', 1, {
      found: false,
      path: '/path/missing.yml',
      workflows: undefined,
    });
    expect(output).toContain('⚠ Workflow file:');
    expect(output).toContain('file not found, skipping');
  });

  test('formats with workflow file error', () => {
    const output = formatWorkflowSources('/path/config.yml', 0, {
      found: true,
      path: '/path/bad.yml',
      workflows: undefined,
      error: 'Missing workflows key',
    });
    expect(output).toContain('⚠ Workflow file:');
    expect(output).toContain('Missing workflows key');
  });

  test('shows zero config workflows', () => {
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
      setup: 'workflow-file',
      main: 'config',
      cleanup: 'config-override',
    },
  };

  test('shows all workflows with source labels', () => {
    const output = formatAvailableWorkflows(merged, 'main');
    expect(output).toContain('Available workflows:');
    expect(output).toContain('setup');
    expect(output).toContain('(workflow file)');
    expect(output).toContain('main');
    expect(output).toContain('(config, default)');
    expect(output).toContain('cleanup');
    expect(output).toContain('(config, overrides workflow file)');
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
    sources: { setup: 'workflow-file', main: 'config' },
  };

  test('builds structured JSON with sources', () => {
    const json = buildWorkflowSourcesJson(
      '/path/config.yml',
      { main: { default: true, steps: [{ run: 'echo' }] } },
      { found: true, path: '/path/workflows.yml', workflows: { setup: { steps: [{ run: 'echo' }] } } },
      merged,
      'main',
    );
    const sources = json['sources'] as Record<string, unknown>;
    expect(sources['config']).toEqual({ path: '/path/config.yml', workflowCount: 1 });
    const wfSource = sources['workflowFile'] as Record<string, unknown>;
    expect(wfSource['found']).toBe(true);
    expect(wfSource['workflowCount']).toBe(1);
    expect(json['selectedWorkflow']).toBe('main');
    expect(json['availableWorkflows']).toHaveLength(2);
  });

  test('omits workflow file section when no workflow file', () => {
    const json = buildWorkflowSourcesJson(
      '/path/config.yml',
      { main: { default: true, steps: [{ run: 'echo' }] } },
      undefined,
      merged,
      'main',
    );
    const sources = json['sources'] as Record<string, unknown>;
    expect(sources['workflowFile']).toBeUndefined();
  });
});
