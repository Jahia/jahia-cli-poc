import { parseSingleWorkflow } from './parse-single-workflow.js';
import type { WorkflowConfig, WorkflowsMap } from './types.js';

/**
 * Parses and validates the optional workflows section.
 * Expects a map of named workflows. At most one may have `default: true`.
 */
export const parseWorkflowsConfig = (rawWorkflows: unknown): WorkflowsMap | undefined => {
  if (rawWorkflows === undefined) {
    return undefined;
  }

  if (typeof rawWorkflows !== 'object' || rawWorkflows === null || Array.isArray(rawWorkflows)) {
    throw new Error('Configuration "workflows" field must be a map of named workflows.');
  }

  const entries = Object.entries(rawWorkflows as Record<string, unknown>);

  if (entries.length === 0) {
    throw new Error('Configuration "workflows" must contain at least one named workflow.');
  }

  const workflows: Record<string, WorkflowConfig> = {};
  const defaultNames: string[] = [];

  entries.forEach(([name, value]) => {
    const workflow = parseSingleWorkflow(value, name);
    workflows[name] = workflow;
    if (workflow.default === true) {
      defaultNames.push(name);
    }
  });

  if (defaultNames.length > 1) {
    throw new Error(
      `Only one workflow may have "default: true". Found ${String(defaultNames.length)}: ${defaultNames.join(', ')}`,
    );
  }

  return workflows;
};
