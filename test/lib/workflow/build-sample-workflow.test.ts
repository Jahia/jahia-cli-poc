import { describe, expect, test } from 'vitest';

import { buildSampleWorkflows } from '../../../src/lib/workflow/build-sample-workflow.js';

describe('buildSampleWorkflows', () => {
  test('returns a workflows map with a main entry', () => {
    const workflows = buildSampleWorkflows();
    expect(workflows['main']).toBeDefined();
  });

  test('main workflow is marked as default', () => {
    const workflows = buildSampleWorkflows();
    expect(workflows['main']?.default).toBe(true);
  });

  test('main workflow has steps', () => {
    const workflows = buildSampleWorkflows();
    const main = workflows['main'];
    expect(main).toBeDefined();
    if (main === undefined) return;
    expect(main.steps.length).toBeGreaterThan(0);
  });

  test('all steps in main have a name', () => {
    const workflows = buildSampleWorkflows();
    const main = workflows['main'];
    expect(main).toBeDefined();
    if (main === undefined) return;
    const allNamed = main.steps.every((step) => step.name !== undefined);
    expect(allNamed).toBe(true);
  });

  test('includes both run and uses steps', () => {
    const workflows = buildSampleWorkflows();
    const main = workflows['main'];
    expect(main).toBeDefined();
    if (main === undefined) return;
    const hasRun = main.steps.some((step) => step.run !== undefined);
    const hasUses = main.steps.some((step) => step.uses !== undefined);
    expect(hasRun).toBe(true);
    expect(hasUses).toBe(true);
  });

  test('no step has both run and uses', () => {
    const workflows = buildSampleWorkflows();
    const main = workflows['main'];
    expect(main).toBeDefined();
    if (main === undefined) return;
    const hasBoth = main.steps.some(
      (step) => step.run !== undefined && step.uses !== undefined,
    );
    expect(hasBoth).toBe(false);
  });
});
