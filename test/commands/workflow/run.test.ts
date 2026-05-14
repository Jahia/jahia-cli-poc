import { describe, expect, test } from 'vitest';

import {
  formatDuration,
  buildWorkflowSummary,
} from '../../../src/commands/workflow/run.js';
import type { StepResult } from '../../../src/lib/workflow/types.js';

describe('formatDuration', () => {
  test('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  test('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  test('formats minutes and seconds', () => {
    expect(formatDuration(125_000)).toBe('2m 5s');
  });

  test('formats exactly one minute', () => {
    expect(formatDuration(60_000)).toBe('1m 0s');
  });
});

describe('buildWorkflowSummary', () => {
  const successSteps: readonly StepResult[] = [
    { name: 'Init', success: true, durationMs: 100 },
    { name: 'Build', success: true, durationMs: 5000 },
  ];

  const failureSteps: readonly StepResult[] = [
    { name: 'Init', success: true, durationMs: 100 },
    { name: 'Build', success: false, error: 'Build failed', durationMs: 3000 },
  ];

  test('shows success header with workflow name', () => {
    const summary = buildWorkflowSummary('main', successSteps, true, 5100);
    expect(summary).toContain('✓ Workflow "main" completed successfully');
  });

  test('shows failure header with workflow name', () => {
    const summary = buildWorkflowSummary('setup', failureSteps, false, 3100);
    expect(summary).toContain('✗ Workflow "setup" failed');
  });

  test('shows check/cross per step', () => {
    const summary = buildWorkflowSummary('main', failureSteps, false, 3100);
    expect(summary).toContain('✓ Init');
    expect(summary).toContain('✗ Build');
  });

  test('includes error message for failed step', () => {
    const summary = buildWorkflowSummary('main', failureSteps, false, 3100);
    expect(summary).toContain('Error: Build failed');
  });

  test('includes total time', () => {
    const summary = buildWorkflowSummary('main', successSteps, true, 5100);
    expect(summary).toContain('Total time: 5s');
  });
});
