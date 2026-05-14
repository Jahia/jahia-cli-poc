import type { JahiaCliConfig, WorkflowsMap } from '../config/types.js';

/**
 * Merges a workflows map into an existing JahiaCliConfig,
 * replacing only the workflows section and preserving all other properties.
 */
export const mergeWorkflowsIntoConfig = (
  existing: JahiaCliConfig,
  workflows: WorkflowsMap,
): JahiaCliConfig => ({
  ...existing,
  workflows,
});
