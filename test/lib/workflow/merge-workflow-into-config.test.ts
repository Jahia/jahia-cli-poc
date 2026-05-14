import { describe, expect, test } from 'vitest';

import { mergeWorkflowsIntoConfig } from '../../../src/lib/workflow/merge-workflow-into-config.js';
import type { JahiaCliConfig, WorkflowsMap } from '../../../src/lib/config/types.js';

describe('mergeWorkflowsIntoConfig', () => {
  const sampleWorkflows: WorkflowsMap = {
    main: {
      default: true,
      steps: [{ name: 'test', run: 'echo hello' }],
    },
  };

  test('adds workflows to an empty config', () => {
    const result = mergeWorkflowsIntoConfig({}, sampleWorkflows);
    expect(result.workflows).toBe(sampleWorkflows);
    expect(result.environment).toBeUndefined();
  });

  test('preserves existing environment section', () => {
    const existing: JahiaCliConfig = {
      environment: {
        name: 'test',
        provider: 'docker',
        components: [{ name: 'jahia' }],
      },
    };
    const result = mergeWorkflowsIntoConfig(existing, sampleWorkflows);
    expect(result.environment).toBe(existing.environment);
    expect(result.workflows).toBe(sampleWorkflows);
  });

  test('preserves existing tests section', () => {
    const existing: JahiaCliConfig = {
      tests: { 'jahia-cypress': 'v1.0.0' },
    };
    const result = mergeWorkflowsIntoConfig(existing, sampleWorkflows);
    expect(result.tests).toBe(existing.tests);
    expect(result.workflows).toBe(sampleWorkflows);
  });

  test('replaces existing workflows section', () => {
    const existing: JahiaCliConfig = {
      workflows: { old: { steps: [{ run: 'old' }] } },
    };
    const result = mergeWorkflowsIntoConfig(existing, sampleWorkflows);
    expect(result.workflows).toBe(sampleWorkflows);
  });
});
