import { describe, expect, test } from 'vitest';

import { mergeWorkflowIntoConfig } from '../../../src/lib/workflow/merge-workflow-into-config.js';
import type { JahiaCliConfig, WorkflowConfig } from '../../../src/lib/config/types.js';

describe('mergeWorkflowIntoConfig', () => {
  const sampleWorkflow: WorkflowConfig = {
    steps: [{ name: 'test', run: 'echo hello' }],
  };

  test('adds workflow to an empty config', () => {
    const result = mergeWorkflowIntoConfig({}, sampleWorkflow);
    expect(result.workflow).toBe(sampleWorkflow);
    expect(result.environment).toBeUndefined();
  });

  test('preserves existing environment section', () => {
    const existing: JahiaCliConfig = {
      environment: {
        components: [{ name: 'jahia' }],
      },
    };
    const result = mergeWorkflowIntoConfig(existing, sampleWorkflow);
    expect(result.environment).toBe(existing.environment);
    expect(result.workflow).toBe(sampleWorkflow);
  });

  test('preserves existing tests section', () => {
    const existing: JahiaCliConfig = {
      tests: { 'jahia-cypress': 'v1.0.0' },
    };
    const result = mergeWorkflowIntoConfig(existing, sampleWorkflow);
    expect(result.tests).toBe(existing.tests);
    expect(result.workflow).toBe(sampleWorkflow);
  });

  test('replaces existing workflow section', () => {
    const existing: JahiaCliConfig = {
      workflow: { steps: [{ run: 'old' }] },
    };
    const result = mergeWorkflowIntoConfig(existing, sampleWorkflow);
    expect(result.workflow).toBe(sampleWorkflow);
  });
});
