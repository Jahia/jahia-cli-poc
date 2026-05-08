import { writeFile } from 'node:fs/promises';

import { Command, Flags } from '@oclif/core';

import { extractExportableConfig } from '../../lib/config/export-config.js';
import { configToYaml } from '../../lib/config/config-to-yaml.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import type { PersistedEnvironment } from '../../lib/state/types.js';
import type { JahiaCliConfig } from '../../lib/config/types.js';

/**
 * Builds the JSON output for the export command.
 */
export const buildExportJsonOutput = (params: {
  readonly config: JahiaCliConfig;
  readonly yaml: string;
  readonly outputPath: string | undefined;
  readonly statePath: string;
}): string =>
  JSON.stringify(
    {
      success: true,
      outputPath: params.outputPath ?? 'stdout',
      statePath: params.statePath,
      config: params.config,
      yaml: params.yaml,
    },
    undefined,
    2,
  );

/**
 * Builds the human-readable success message after export.
 */
export const buildExportSuccessMessage = (params: {
  readonly outputPath: string;
  readonly environmentName: string;
}): string =>
  `✓ Environment "${params.environmentName}" configuration exported to ${params.outputPath}\n\n` +
  '  This file can be used to recreate the environment:\n' +
  `  jahia-cli environment create --config ${params.outputPath}`;

export default class EnvironmentExport extends Command {
  static override description =
    'Export the active environment configuration to a YAML file. ' +
    'The exported config contains only what is needed to recreate the environment — ' +
    'no runtime state (container IDs, timestamps, network names).';

  static override examples = [
    '<%= config.bin %> environment export --output ./env.yml',
    '<%= config.bin %> environment export --stdout',
    '<%= config.bin %> environment export --output ./env.yml --json',
  ];

  static override flags = {
    state: stateFlag,
    output: Flags.string({
      char: 'o',
      description: 'Path to write the YAML configuration file',
    }),
    stdout: Flags.boolean({
      description: 'Print the YAML configuration to stdout instead of writing to a file',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentExport);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    // Validate flags — need either --output or --stdout
    if (!flags.output && !flags.stdout) {
      this.error(
        'Specify --output <path> to write a file, or --stdout to print to terminal.\n\n' +
          '  Example: jahia-cli environment export --output ./env.yml\n' +
          `  State: ${statePath}`,
      );
      return;
    }

    if (flags.output && flags.stdout) {
      this.error('Cannot use both --output and --stdout. Choose one.');
      return;
    }

    // Load active environment
    const environment: PersistedEnvironment | undefined = await getActiveEnvironment(stateOverride);
    if (!environment) {
      this.error(
        'No active environment to export.\n\n' +
          '  Create one first: jahia-cli environment create\n' +
          `  State: ${statePath}`,
      );
      return;
    }

    // Extract exportable config and serialize
    const exportableConfig = extractExportableConfig(environment);
    const yamlContent = configToYaml(exportableConfig);

    // Write or print
    if (flags.stdout) {
      if (flags.json) {
        this.log(
          buildExportJsonOutput({
            config: exportableConfig,
            yaml: yamlContent,
            outputPath: undefined,
            statePath,
          }),
        );
      } else {
        this.log(yamlContent);
      }
    } else if (flags.output) {
      const outputPath = flags.output;
      await writeFile(outputPath, yamlContent, 'utf-8');

      if (flags.json) {
        this.log(
          buildExportJsonOutput({
            config: exportableConfig,
            yaml: yamlContent,
            outputPath,
            statePath,
          }),
        );
      } else {
        this.log(buildExportSuccessMessage({ outputPath, environmentName: environment.name }));
        this.log(`\n  State: ${statePath}`);
      }
    }
  }
}
