import type { WorkflowConfig, WorkflowsMap } from '../config/types.js';

/**
 * Source attribution for each workflow in the merged map.
 * - 'workflow-file': from the dedicated workflows file
 * - 'config': from the main config file
 * - 'config-override': defined in config, overriding a same-name workflow from the workflow file
 */
export type WorkflowSource = 'workflow-file' | 'config' | 'config-override';

/**
 * Result of merging global and local workflow sources.
 * Includes the merged workflows map and per-name source attribution.
 */
export interface MergedWorkflowsResult {
  readonly workflows: WorkflowsMap;
  readonly sources: Readonly<Record<string, WorkflowSource>>;
}

/**
 * Strips `default: true` from all workflows in a map.
 * Used to clear global defaults when a local default exists.
 */
const stripDefaults = (
  workflows: WorkflowsMap,
): WorkflowsMap =>
  Object.fromEntries(
    Object.entries(workflows).map(([name, wf]) => [
      name,
      wf.default === true
        ? { steps: wf.steps }
        : wf,
    ]),
  );

/**
 * Merges global and local workflow sources.
 *
 * Rules:
 * - Local workflows always override global workflows with the same name.
 * - If any local workflow has `default: true`, global defaults are stripped
 *   to prevent multiple defaults in the merged map.
 * - Source attribution tracks whether each workflow came from global, local,
 *   or is a local override of a global workflow.
 *
 * Returns undefined if both sources are undefined.
 */
export const mergeWorkflowSources = (
  global: WorkflowsMap | undefined,
  local: WorkflowsMap | undefined,
): MergedWorkflowsResult | undefined => {
  if (global === undefined && local === undefined) {
    return undefined;
  }

  if (global === undefined) {
    const sources: Record<string, WorkflowSource> = {};
    Object.keys(local ?? {}).forEach((name) => {
      sources[name] = 'config';
    });
    return { workflows: local ?? {}, sources };
  }

  if (local === undefined) {
    const sources: Record<string, WorkflowSource> = {};
    Object.keys(global).forEach((name) => {
      sources[name] = 'workflow-file';
    });
    return { workflows: global, sources };
  }

  const localHasDefault = Object.values(local).some((wf) => wf.default === true);
  const effectiveGlobal = localHasDefault ? stripDefaults(global) : global;

  const merged: Record<string, WorkflowConfig> = { ...effectiveGlobal, ...local };
  const sources: Record<string, WorkflowSource> = {};

  Object.keys(merged).forEach((name) => {
    if (name in local) {
      sources[name] = name in global ? 'config-override' : 'config';
    } else {
      sources[name] = 'workflow-file';
    }
  });

  return { workflows: merged, sources };
};
