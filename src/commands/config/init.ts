import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { buildBlankConfig } from '../../lib/config/build-blank-config.js';
import { initializeConfigFile } from '../../lib/config/initialize-config-file.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

const DEFAULT_OUTPUT = 'jahia-cli.config.yml';

export default class ConfigInit extends Command {
  static override description =
    'Generate an initialized Jahia CLI configuration file. ' +
    'Creates a blank scaffold with environment and tests sections.';

  static override examples = [
    '<%= config.bin %> config init',
    '<%= config.bin %> config init --output ./my-config.yml',
    '<%= config.bin %> config init --force --json',
  ];

  static override flags = {
    output: Flags.string({
      char: 'o',
      description: 'Path to write the configuration YAML file',
      default: DEFAULT_OUTPUT,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite output file if it already exists',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConfigInit);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
    const outputFile = resolve(flags.output);

    try {
      const config = buildBlankConfig();

      const initialized = await initializeConfigFile({
        outputFile,
        config,
        force: flags.force,
      });

      if (!initialized.written) {
        const message = `Configuration file already exists at "${outputFile}". Use --force to overwrite.`;
        if (flags.json) {
          this.log(
            JSON.stringify({ success: false, error: 'file_exists', message, outputFile }, null, 2),
          );
          this.exit(1);
        }
        this.error(message);
        return;
      }

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              success: true,
              outputFile,
            },
            null,
            2,
          ),
        );
      } else {
        this.log(`✓ Configuration initialized at ${outputFile}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              success: false,
              error: 'config_init_failed',
              message,
              outputFile,
            },
            null,
            2,
          ),
        );
      } else {
        this.error(message);
      }
      this.exit(1);
    }
  }
}
