import type { JahiaCliConfig, WorkflowConfig } from '../config/types.js';

/**
 * Merges a workflow config into an existing JahiaCliConfig,
 * replacing only the workflow section and preserving all other properties.
 */
export const mergeWorkflowIntoConfig = (
  existing: JahiaCliConfig,
  workflow: WorkflowConfig,
): JahiaCliConfig => ({
  ...existing,
  workflow,
});
