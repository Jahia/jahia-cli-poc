import type { WorkflowConfig, WorkflowsMap } from '../config/types.js';

/**
 * Resolves a workflow by name from the workflows map.
 * Throws if the named workflow does not exist.
 */
export const resolveWorkflowByName = (
  workflows: WorkflowsMap,
  name: string,
): WorkflowConfig => {
  const workflow = workflows[name];
  if (workflow === undefined) {
    const available = Object.keys(workflows).join(', ');
    throw new Error(
      `Workflow "${name}" not found. Available workflows: ${available}`,
    );
  }
  return workflow;
};

/**
 * Resolves the default workflow from the workflows map.
 * Throws if no workflow has `default: true`.
 */
export const resolveDefaultWorkflow = (
  workflows: WorkflowsMap,
): { readonly name: string; readonly workflow: WorkflowConfig } => {
  const defaultEntry = Object.entries(workflows).find(
    ([, wf]) => wf.default === true,
  );

  if (defaultEntry === undefined) {
    const available = Object.keys(workflows).join(', ');
    throw new Error(
      `No default workflow found. Use --name to specify one.\n` +
      `  Available workflows: ${available}\n\n` +
      '  Or mark one workflow with "default: true" in your config.',
    );
  }

  return { name: defaultEntry[0], workflow: defaultEntry[1] };
};

/**
 * Detects circular workflow calls by checking if a workflow name
 * is already in the call stack.
 */
export const detectCircularCall = (
  workflowName: string,
  callStack: readonly string[],
): void => {
  if (callStack.includes(workflowName)) {
    const chain = [...callStack, workflowName].join(' → ');
    throw new Error(
      `Circular workflow detected: ${chain}\n` +
      `  Workflow "${workflowName}" is already being executed.`,
    );
  }
};
