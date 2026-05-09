import { describe, expect, test } from 'vitest';

import { buildSampleWorkflow } from '../../../src/lib/workflow/build-sample-workflow.js';

describe('buildSampleWorkflow', () => {
  test('returns a workflow with steps', () => {
    const workflow = buildSampleWorkflow();
    expect(workflow.steps).toBeDefined();
    expect(workflow.steps.length).toBeGreaterThan(0);
  });

  test('all steps have a name', () => {
    const workflow = buildSampleWorkflow();
    const allNamed = workflow.steps.every((step) => step.name !== undefined);
    expect(allNamed).toBe(true);
  });

  test('includes both run and uses steps', () => {
    const workflow = buildSampleWorkflow();
    const hasRun = workflow.steps.some((step) => step.run !== undefined);
    const hasUses = workflow.steps.some((step) => step.uses !== undefined);
    expect(hasRun).toBe(true);
    expect(hasUses).toBe(true);
  });

  test('no step has both run and uses', () => {
    const workflow = buildSampleWorkflow();
    const hasBoth = workflow.steps.some(
      (step) => step.run !== undefined && step.uses !== undefined,
    );
    expect(hasBoth).toBe(false);
  });
});
