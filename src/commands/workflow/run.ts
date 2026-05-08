import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { loadConfigFile } from '../../lib/config/parser.js';
import { executeWorkflow } from '../../lib/workflow/executor.js';
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
  steps: readonly StepResult[],
  success: boolean,
  totalDurationMs: number,
): string => {
  const header = success ? '✓ Workflow completed successfully' : '✗ Workflow failed';

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
    'Execute a workflow defined in a configuration file. ' +
    'Runs steps sequentially — shell commands via execa, ' +
    'jahia-cli commands via subprocess. Stops on first failure.';

  static override examples = [
    '<%= config.bin %> workflow run --config jahia-cli.config.yml',
    '<%= config.bin %> workflow run --config ./my-config.yml --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to the YAML configuration file',
      required: true,
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

    const config = await loadConfigFile(configPath);

    if (config.workflow === undefined) {
      this.error(
        'No workflow section found in configuration file.\n\n' +
          '  Run "jahia-cli workflow init" to generate a sample workflow.',
      );
      return;
    }

    const { steps } = config.workflow;

    if (!flags.json) {
      this.log(`▶ Running workflow (${String(steps.length)} steps)\n`);
    }

    const cliEntryPoint = resolve(this.config.root, 'bin', 'run.js');

    const result = await executeWorkflow({
      steps,
      configPath,
      statePath: flags.state,
      cwd: process.cwd(),
      cliEntryPoint,
      onStepStart: flags.json
        ? undefined
        : (name: string, index: number): void => {
            this.log(`  [${String(index + 1)}/${String(steps.length)}] ${name}...`);
          },
      onStepComplete: undefined,
    });

    if (flags.json) {
      this.log(JSON.stringify(result, undefined, 2));
    } else {
      this.log('');
      this.log(buildWorkflowSummary(result.steps, result.success, result.totalDurationMs));
    }

    if (!result.success) {
      this.exit(1);
    }
  }
}
