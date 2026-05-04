import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { buildBlankConfig } from '../../lib/config/build-blank-config.js';
import { buildConfigFromState } from '../../lib/config/build-config-from-state.js';
import { configToYaml } from '../../lib/config/config-to-yaml.js';
import { loadState } from '../../lib/state/load-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';

const DEFAULT_OUTPUT = 'jahia-cli.config.yml';

export default class ConfigInit extends Command {
  static override description =
    'Generate an initialized Jahia CLI configuration file. ' +
    'By default, derives config from active environment state; use --blank for an empty scaffold.';

  static override examples = [
    '<%= config.bin %> config init',
    '<%= config.bin %> config init --blank',
    '<%= config.bin %> config init --state ~/.jahia-cli/state.json --output ./my-config.yml',
    '<%= config.bin %> config init --blank --force --json',
  ];

  static override flags = {
    state: stateFlag,
    output: Flags.string({
      char: 'o',
      description: 'Path to write the configuration YAML file',
      default: DEFAULT_OUTPUT,
    }),
    blank: Flags.boolean({
      description: 'Generate a blank configuration scaffold instead of deriving from state',
      default: false,
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
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConfigInit);
    const outputFile = resolve(flags.output);
    const stateOverride = flags.state;
    const stateFile = stateFilePath(stateOverride);

    const outputExists = await access(outputFile)
      .then(() => true)
      .catch(() => false);

    if (outputExists && !flags.force) {
      const message = `Configuration file already exists at "${outputFile}". Use --force to overwrite.`;
      if (flags.json) {
        this.log(
          JSON.stringify({ success: false, error: 'file_exists', message, outputFile, stateFile }, null, 2),
        );
        this.exit(1);
      }
      this.error(message);
      return;
    }

    try {
      const config = flags.blank
        ? buildBlankConfig()
        : buildConfigFromState(await loadState(stateOverride));
      const yamlContent = configToYaml(config);

      await mkdir(dirname(outputFile), { recursive: true });
      await writeFile(outputFile, yamlContent, 'utf-8');

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              success: true,
              mode: flags.blank ? 'blank' : 'state',
              outputFile,
              ...(flags.blank ? {} : { stateFile }),
            },
            null,
            2,
          ),
        );
      } else {
        this.log(`✓ Configuration initialized at ${outputFile}`);
        this.log(`  Mode: ${flags.blank ? 'blank' : 'state'}`);
        if (!flags.blank) {
          this.log(`  State: ${stateFile}`);
        }
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
              ...(flags.blank ? {} : { stateFile }),
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
