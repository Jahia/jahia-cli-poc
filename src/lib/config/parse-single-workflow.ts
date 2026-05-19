import { validateWorkflowStep } from './validate-workflow-step.js';
import type { WorkflowConfig, WorkflowStep } from './types.js';

/**
 * Parses and validates a single named workflow entry (the value under a workflow name key).
 */
export const parseSingleWorkflow = (rawWorkflow: unknown, name: string): WorkflowConfig => {
  if (typeof rawWorkflow !== 'object' || rawWorkflow === null || Array.isArray(rawWorkflow)) {
    throw new Error(`Workflow "${name}" must be an object.`);
  }

  const record = rawWorkflow as Record<string, unknown>;

  if (!Array.isArray(record['steps'])) {
    throw new Error(`Workflow "${name}" must include a "steps" array.`);
  }

  if (record['steps'].length === 0) {
    throw new Error(`Workflow "${name}.steps" must contain at least one step.`);
  }

  const steps: readonly WorkflowStep[] = (record['steps'] as unknown[]).map(
    (entry, index) => validateWorkflowStep(entry, index),
  );

  const isDefault = record['default'] === true ? true : undefined;

  return {
    ...(isDefault === undefined ? {} : { default: isDefault }),
    steps,
  };
};
