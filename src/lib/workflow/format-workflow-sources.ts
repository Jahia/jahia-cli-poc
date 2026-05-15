import type { WorkflowsMap } from '../config/types.js';
import type { GlobalWorkflowsLoadResult } from './load-global-workflows.js';
import type { MergedWorkflowsResult, WorkflowSource } from './merge-workflow-sources.js';

/**
 * Builds the human-readable "Workflow sources:" section.
 */
export const formatWorkflowSources = (
  configPath: string,
  configWorkflowCount: number,
  workflowFileResult: GlobalWorkflowsLoadResult | undefined,
): string => {
  const lines: string[] = ['▶ Workflow sources:'];

  const configLabel = configWorkflowCount > 0
    ? `✓ Config:        ${configPath} (${String(configWorkflowCount)} workflows)`
    : `  Config:        ${configPath} (no workflows)`;
  lines.push(`  ${configLabel}`);

  if (workflowFileResult !== undefined) {
    if (!workflowFileResult.found) {
      lines.push(`  ⚠ Workflow file: ${workflowFileResult.path} (file not found, skipping)`);
    } else if (workflowFileResult.error !== undefined) {
      lines.push(`  ⚠ Workflow file: ${workflowFileResult.path} (${workflowFileResult.error})`);
    } else {
      const count = workflowFileResult.workflows !== undefined
        ? Object.keys(workflowFileResult.workflows).length
        : 0;
      lines.push(`  ✓ Workflow file: ${workflowFileResult.path} (${String(count)} workflows loaded)`);
    }
  }

  return lines.join('\n');
};

/**
 * Returns a human-readable source label for a workflow.
 */
const sourceLabel = (source: WorkflowSource): string => {
  const labels: Readonly<Record<WorkflowSource, string>> = {
    'workflow-file': 'workflow file',
    'config': 'config',
    'config-override': 'config, overrides workflow file',
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
    const source = mergedResult.sources[name] ?? 'config';
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
    config: {
      path: configPath,
      workflowCount: localWorkflows !== undefined ? Object.keys(localWorkflows).length : 0,
    },
    ...(globalResult !== undefined
      ? {
          workflowFile: {
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
