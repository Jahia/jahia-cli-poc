import { dirname, resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { loadConfigFile } from '../../lib/config/parser.js';
import { executeWorkflow } from '../../lib/workflow/executor.js';
import {
  buildWorkflowSourcesJson,
  formatAvailableWorkflows,
  formatWorkflowSources,
} from '../../lib/workflow/format-workflow-sources.js';
import { loadGlobalWorkflows } from '../../lib/workflow/load-global-workflows.js';
import type { GlobalWorkflowsLoadResult } from '../../lib/workflow/load-global-workflows.js';
import { mergeWorkflowSources } from '../../lib/workflow/merge-workflow-sources.js';
import { resolveDefaultWorkflow, resolveWorkflowByName } from '../../lib/workflow/resolve-workflow.js';
import { resolveWorkflowsFilePath } from '../../lib/workflow/resolve-workflows-file-path.js';
import type { StepResult } from '../../lib/workflow/types.js';

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${String(ms)}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${String(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes)}m ${String(remainingSeconds)}s`;
};

/**
 * Builds a formatted summary of workflow execution for human-readable output.
 */
export const buildWorkflowSummary = (
  workflowName: string,
  steps: readonly StepResult[],
  success: boolean,
  totalDurationMs: number,
): string => {
  const header = success
    ? `✓ Workflow "${workflowName}" completed successfully`
    : `✗ Workflow "${workflowName}" failed`;

  const stepLines = steps.map(
    (step) =>
      `  ${step.success ? '✓' : '✗'} ${step.name} (${formatDuration(step.durationMs)})${
        step.error !== undefined ? `\n    Error: ${step.error}` : ''
      }`,
  );

  return [
    header,
    '',
    '  Steps:',
    ...stepLines,
    '',
    `  Total time: ${formatDuration(totalDurationMs)}`,
  ].join('\n');
};

export default class WorkflowRun extends Command {
  static override description =
    'Execute a named workflow defined in a configuration file. ' +
    'Supports loading shared workflows from a dedicated workflows file ' +
    '(via --workflows-file flag or workflowsFile config key, ' +
    'defaults to jahia-cli.workflows.global.yml in CWD). ' +
    'Config workflows override workflow file ones with the same name. ' +
    'Runs steps sequentially — shell commands via execa, ' +
    'jahia-cli commands via subprocess. Stops on first failure. ' +
    'Use --name to select a workflow, or omit to run the default.';

  static override examples = [
    '<%= config.bin %> workflow run --config jahia-cli.config.yml',
    '<%= config.bin %> workflow run --config jahia-cli.config.yml --name setup',
    '<%= config.bin %> workflow run --config jahia-cli.config.yml --workflows-file shared.yml',
    '<%= config.bin %> workflow run --config ./my-config.yml --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to the YAML configuration file',
      required: true,
    }),
    name: Flags.string({
      char: 'n',
      description: 'Name of the workflow to run (runs default workflow if omitted)',
    }),
    'workflows-file': Flags.string({
      char: 'w',
      description:
        'Path to a dedicated workflows YAML file. ' +
        'Merged with config workflows (config takes precedence). ' +
        'Resolved relative to CWD. Overrides the workflowsFile config key. ' +
        'Defaults to jahia-cli.workflows.global.yml in CWD.',
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    state: Flags.string({
      char: 's',
      description: 'Path to the state file (auto-passed to jahia-cli subcommands)',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(WorkflowRun);
    const configPath = resolve(flags.config);
    const configDir = dirname(configPath);

    const config = await loadConfigFile(configPath);

    // Resolve workflows file path (flag > config key > default)
    const { path: workflowsFilePath, isExplicit } = resolveWorkflowsFilePath(
      configDir,
      config.workflowsFile,
      flags['workflows-file'],
    );

    // Load workflows file — always attempt since we now have a default
    const workflowFileResult: GlobalWorkflowsLoadResult = await loadGlobalWorkflows(workflowsFilePath);

    // If the user explicitly specified a file that doesn't exist, warn but continue
    if (!workflowFileResult.found && isExplicit) {
      this.warn(
        `Workflows file not found: ${workflowsFilePath}\n` +
        `  The command will continue using workflows from the config file only.`,
      );
    }

    // Only pass the result downstream when the file was found or explicitly requested
    // (so the UI can show the "not found" warning). Skip silently for missing defaults.
    const effectiveFileResult: GlobalWorkflowsLoadResult | undefined =
      workflowFileResult.found || isExplicit ? workflowFileResult : undefined;

    // Merge workflow file + config (config wins)
    const mergedResult = mergeWorkflowSources(
      workflowFileResult.workflows,
      config.workflows,
    );

    const effectiveWorkflows = mergedResult?.workflows;

    if (effectiveWorkflows === undefined || Object.keys(effectiveWorkflows).length === 0) {
      this.error(
        'No workflows found in config or workflows file.\n\n' +
          '  Run "jahia-cli workflow init" to generate sample workflows,\n' +
          '  or specify a workflows file with --workflows-file.',
      );
      return;
    }

    // mergedResult is guaranteed defined when effectiveWorkflows is defined
    const merged = mergedResult ?? { workflows: effectiveWorkflows, sources: {} };

    // Resolve which workflow to run
    const { name: workflowName, workflow } = flags.name !== undefined
      ? { name: flags.name, workflow: resolveWorkflowByName(effectiveWorkflows, flags.name) }
      : resolveDefaultWorkflow(effectiveWorkflows);

    const { steps } = workflow;

    // Log verbose source/selection info
    if (!flags.json) {
      this.log(formatWorkflowSources(
        configPath,
        config.workflows !== undefined ? Object.keys(config.workflows).length : 0,
        effectiveFileResult,
      ));
      this.log('');
      this.log(formatAvailableWorkflows(merged, workflowName));
      this.log('');
      this.log(`▶ Running workflow "${workflowName}" (${String(steps.length)} steps)\n`);
    }

    const cliEntryPoint = resolve(this.config.root, 'bin', 'run.js');

    const result = await executeWorkflow({
      steps,
      configPath,
      statePath: flags.state,
      cwd: process.cwd(),
      cliEntryPoint,
      workflows: effectiveWorkflows,
      callStack: [workflowName],
      onStepStart: flags.json
        ? undefined
        : (stepName: string, index: number): void => {
            this.log(`  [${String(index + 1)}/${String(steps.length)}] ${stepName}...`);
          },
      onStepComplete: undefined,
    });

    if (flags.json) {
      const sourcesJson = buildWorkflowSourcesJson(
        configPath,
        config.workflows,
        effectiveFileResult,
        merged,
        workflowName,
      );
      this.log(JSON.stringify({ ...sourcesJson, ...result, workflowName }, undefined, 2));
    } else {
      this.log('');
      this.log(buildWorkflowSummary(workflowName, result.steps, result.success, result.totalDurationMs));
    }

    if (!result.success) {
      this.exit(1);
    }
  }
}
