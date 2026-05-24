import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import yaml from 'js-yaml';

import { configToYaml } from '../../lib/config/config-to-yaml.js';
import { validateConfig } from '../../lib/config/parser.js';
import type { JahiaCliConfig, RawConfig } from '../../lib/config/types.js';
import { buildSampleWorkflows } from '../../lib/workflow/build-sample-workflow.js';
import { mergeWorkflowsIntoConfig } from '../../lib/workflow/merge-workflow-into-config.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

const DEFAULT_CONFIG_FILE = 'jahia-cli.config.yml';

/**
 * Loads an existing config file if it exists, returning an empty config if not found.
 */
export const loadExistingConfigForWorkflow = async (filePath: string): Promise<JahiaCliConfig> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = yaml.load(content) as RawConfig;
    return validateConfig(raw);
  } catch {
    return {};
  }
};

/**
 * Builds a human-readable success message for the workflow init command.
 */
export const buildWorkflowInitSuccessMessage = (outputPath: string): string =>
  `✓ Sample workflows added to ${outputPath}\n\n` +
  '  Edit the workflow steps to match your needs, then run:\n' +
  `  jahia-cli workflow run --config ${outputPath}`;

export default class WorkflowInit extends Command {
  static override description =
    'Add sample workflows section to a configuration file. ' +
    'Generates a named "main" workflow with representative steps ' +
    '(init, create, alive, test, cleanup) to help get started. ' +
    'Preserves existing environment and tests sections.';

  static override examples = [
    '<%= config.bin %> workflow init',
    '<%= config.bin %> workflow init --config ./my-config.yml',
    '<%= config.bin %> workflow init --force',
    '<%= config.bin %> workflow init --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to the YAML configuration file',
      default: DEFAULT_CONFIG_FILE,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing workflows section if already present',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(WorkflowInit);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
    const configPath = resolve(flags.config);

    const existingConfig = await loadExistingConfigForWorkflow(configPath);

    if (existingConfig.workflows !== undefined && !flags.force) {
      const msg =
        `Configuration file already has a workflows section.\n\n` +
        `  File: ${configPath}\n\n` +
        '  Use --force to overwrite the existing workflows.';
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'workflows_exists', file: configPath }));
      } else {
        this.error(msg);
      }
      return;
    }

    const sampleWorkflows = buildSampleWorkflows();
    const merged = mergeWorkflowsIntoConfig(existingConfig, sampleWorkflows);
    const yamlContent = configToYaml(merged);
    await writeFile(configPath, yamlContent, 'utf-8');

    if (flags.json) {
      this.log(
        JSON.stringify(
          { success: true, file: configPath, workflows: sampleWorkflows },
          undefined,
          2,
        ),
      );
    } else {
      this.log(buildWorkflowInitSuccessMessage(configPath));
    }
  }
}
