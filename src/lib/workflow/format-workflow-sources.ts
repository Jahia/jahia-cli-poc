import type { WorkflowsMap } from '../config/types.js';
import type { GlobalWorkflowsLoadResult } from './load-global-workflows.js';
import type { MergedWorkflowsResult, WorkflowSource } from './merge-workflow-sources.js';

/**
 * Builds the human-readable "Workflow sources:" section.
 */
export const formatWorkflowSources = (
  configPath: string,
  localWorkflowCount: number,
  globalResult: GlobalWorkflowsLoadResult | undefined,
): string => {
  const lines: string[] = ['▶ Workflow sources:'];

  const localLabel = localWorkflowCount > 0
    ? `✓ Local config: ${configPath} (${String(localWorkflowCount)} workflows)`
    : `  Local config: ${configPath} (no workflows)`;
  lines.push(`  ${localLabel}`);

  if (globalResult !== undefined) {
    if (!globalResult.found) {
      lines.push(`  ⚠ Global file:  ${globalResult.path} (file not found, skipping)`);
    } else if (globalResult.error !== undefined) {
      lines.push(`  ⚠ Global file:  ${globalResult.path} (${globalResult.error})`);
    } else {
      const count = globalResult.workflows !== undefined
        ? Object.keys(globalResult.workflows).length
        : 0;
      lines.push(`  ✓ Global file:  ${globalResult.path} (${String(count)} workflows loaded)`);
    }
  }

  return lines.join('\n');
};

/**
 * Returns a human-readable source label for a workflow.
 */
const sourceLabel = (source: WorkflowSource): string => {
  const labels: Readonly<Record<WorkflowSource, string>> = {
    'global': 'global',
    'local': 'local',
    'local-override': 'local, overrides global',
  };
  return labels[source];
};

/**
 * Builds the human-readable "Available workflows:" section.
 * Marks the selected workflow with → and the default with (default).
 */
export const formatAvailableWorkflows = (
  mergedResult: MergedWorkflowsResult,
  selectedName: string,
): string => {
  const lines: string[] = ['▶ Available workflows:'];

  Object.entries(mergedResult.workflows).forEach(([name, wf]) => {
    const source = mergedResult.sources[name] ?? 'local';
    const isSelected = name === selectedName;
    const isDefault = wf.default === true;
    const prefix = isSelected ? '→' : ' ';
    const defaultTag = isDefault ? ', default' : '';
    const selectedTag = isSelected ? '        ← selected' : '';
    const padded = name.padEnd(16);
    lines.push(`  ${prefix} ${padded}(${sourceLabel(source)}${defaultTag})${selectedTag}`);
  });

  return lines.join('\n');
};

/**
 * Builds structured source info for JSON output.
 */
export const buildWorkflowSourcesJson = (
  configPath: string,
  localWorkflows: WorkflowsMap | undefined,
  globalResult: GlobalWorkflowsLoadResult | undefined,
  mergedResult: MergedWorkflowsResult,
  selectedName: string,
): Record<string, unknown> => ({
  sources: {
    local: {
      path: configPath,
      workflowCount: localWorkflows !== undefined ? Object.keys(localWorkflows).length : 0,
    },
    ...(globalResult !== undefined
      ? {
          global: {
            path: globalResult.path,
            found: globalResult.found,
            ...(globalResult.error !== undefined ? { error: globalResult.error } : {}),
            workflowCount: globalResult.workflows !== undefined
              ? Object.keys(globalResult.workflows).length
              : 0,
          },
        }
      : {}),
  },
  availableWorkflows: Object.entries(mergedResult.workflows).map(([name, wf]) => ({
    name,
    source: mergedResult.sources[name],
    default: wf.default === true,
    selected: name === selectedName,
  })),
  selectedWorkflow: selectedName,
});
