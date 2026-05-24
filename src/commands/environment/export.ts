import { readFile, writeFile } from 'node:fs/promises';

import { Command, Flags } from '@oclif/core';
import yaml from 'js-yaml';

import {
  extractExportableConfig,
  mergeEnvironmentIntoConfig,
} from '../../lib/config/export-config.js';
import { configToYaml } from '../../lib/config/config-to-yaml.js';
import { validateConfig } from '../../lib/config/parser.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import type { PersistedEnvironment } from '../../lib/state/types.js';
import type { JahiaCliConfig, RawConfig } from '../../lib/config/types.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

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

/**
 * Loads an existing config file if it exists, returning an empty config if not found.
 * This allows merging the environment section into an existing config without losing other sections.
 */
export const loadExistingConfig = async (filePath: string): Promise<JahiaCliConfig> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = yaml.load(content) as RawConfig;
    return validateConfig(raw);
  } catch {
    return {};
  }
};

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
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentExport);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
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

    // Extract exportable environment config
    const envConfig = extractExportableConfig(environment);

    // Write or print
    if (flags.stdout) {
      const fullConfig: JahiaCliConfig = { environment: envConfig };
      const yamlContent = configToYaml(fullConfig);
      if (flags.json) {
        this.log(
          buildExportJsonOutput({
            config: fullConfig,
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
      // Load existing config to preserve other sections (e.g., tests)
      const existingConfig = await loadExistingConfig(outputPath);
      const mergedConfig = mergeEnvironmentIntoConfig(existingConfig, envConfig);
      const yamlContent = configToYaml(mergedConfig);
      await writeFile(outputPath, yamlContent, 'utf-8');

      if (flags.json) {
        this.log(
          buildExportJsonOutput({
            config: mergedConfig,
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
