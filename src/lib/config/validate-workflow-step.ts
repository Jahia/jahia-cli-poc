import type { WorkflowStep } from './types.js';

/**
 * Validates a single workflow step entry.
 * Each step must have either `run` (shell command) or `uses` (CLI command), not both.
 */
export const validateWorkflowStep = (raw: unknown, index: number): WorkflowStep => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Workflow step at index ${String(index)} must be an object.`);
  }

  const record = raw as Record<string, unknown>;
  const name = typeof record['name'] === 'string' ? record['name'] : undefined;
  const run = typeof record['run'] === 'string' ? record['run'] : undefined;
  const uses = typeof record['uses'] === 'string' ? record['uses'] : undefined;
  const workingDir = typeof record['working_dir'] === 'string' ? record['working_dir'] : undefined;

  if (run === undefined && uses === undefined) {
    throw new Error(
      `Workflow step at index ${String(index)} must have either "run" (shell command) or "uses" (CLI command).`,
    );
  }

  if (run !== undefined && uses !== undefined) {
    throw new Error(
      `Workflow step at index ${String(index)} must have either "run" or "uses", not both.`,
    );
  }

  const withRecord =
    record['with'] !== undefined && typeof record['with'] === 'object' && record['with'] !== null && !Array.isArray(record['with'])
      ? (record['with'] as Record<string, string>)
      : undefined;

  return {
    ...(name === undefined ? {} : { name }),
    ...(run === undefined ? {} : { run }),
    ...(uses === undefined ? {} : { uses }),
    ...(withRecord === undefined ? {} : { with: withRecord }),
    ...(workingDir === undefined ? {} : { working_dir: workingDir }),
  };
};
