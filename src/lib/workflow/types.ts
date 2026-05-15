import type { WorkflowStep } from '../config/types.js';
import { resolveEnvVars } from '../config/resolve-env-vars.js';

/**
 * Result of executing a single workflow step.
 */
export interface StepResult {
  readonly name: string;
  readonly success: boolean;
  readonly error?: string | undefined;
  readonly durationMs: number;
}

/**
 * Result of executing the entire workflow.
 */
export interface WorkflowResult {
  readonly success: boolean;
  readonly steps: readonly StepResult[];
  readonly totalDurationMs: number;
}

/**
 * Builds a step display name from its definition.
 */
export const getStepDisplayName = (step: WorkflowStep, index: number): string =>
  step.name ?? step.uses ?? step.run ?? `Step ${String(index + 1)}`;

/**
 * Converts the `with` record from a workflow step into CLI flag arguments.
 * Each key-value pair becomes --key value in the argument list.
 * Boolean values are handled specially: 'true' emits --key (no value),
 * 'false' omits the flag entirely (OCLIF boolean flags are toggles).
 *
 * Values support ${VAR} and ${VAR:-default} env var substitution,
 * consistent with other config sections (component overrides, workflowsFile, etc.).
 */
export const buildFlagsFromWith = (
  withRecord: Readonly<Record<string, string>> | undefined,
): readonly string[] => {
  if (withRecord === undefined) {
    return [];
  }

  return Object.entries(withRecord).flatMap(([key, value]) => {
    const resolved = resolveEnvVars(value);

    if (resolved === 'true') {
      return [`--${key}`];
    }

    if (resolved === 'false') {
      return [];
    }

    return [`--${key}`, resolved];
  });
};
