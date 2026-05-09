import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { confirm, input } from '@inquirer/prompts';

import { configToYamlWithComments } from '../lib/config/config-to-yaml-with-comments.js';
import {
  DEFAULT_PROVIDER,
  DEFAULT_SCAFFOLDING_PATH,
  DEFAULT_SCAFFOLDING_REPOSITORY,
  DEFAULT_SCAFFOLDING_VERSION,
  generateEnvName,
} from '../lib/config/defaults.js';
import type {
  EnvironmentConfig,
  JahiaCliConfig,
  TestsConfig,
} from '../lib/config/types.js';
import { jahia as jahiaComponent } from '../lib/components/jahia.js';
import { buildSampleWorkflow } from '../lib/workflow/build-sample-workflow.js';

const DEFAULT_CONFIG_FILENAME = 'jahia-cli.config.yml';

/**
 * Prompts the user for config file name and directory.
 * Returns the resolved absolute path.
 */
export const promptForConfigPath = async (): Promise<string> => {
  const filename = await input({
    message: 'Configuration file name:',
    default: DEFAULT_CONFIG_FILENAME,
  });

  const directory = await input({
    message: 'Directory to store the configuration:',
    default: '.',
  });

  return resolve(directory, filename);
};

/**
 * Prompts the user for environment configuration.
 * Returns a ready-to-use EnvironmentConfig.
 */
export const promptForEnvironmentConfig = async (): Promise<EnvironmentConfig> => {
  const name = await input({
    message: 'Environment name:',
    default: generateEnvName(),
  });

  const jahiaVersion = await input({
    message: 'Jahia version:',
    default: jahiaComponent.defaultTag,
  });

  return {
    name,
    provider: DEFAULT_PROVIDER,
    components: [
      {
        name: 'jahia',
        ...(jahiaVersion !== jahiaComponent.defaultTag
          ? { overrides: { tag: jahiaVersion } }
          : {}),
      },
    ],
  };
};

/**
 * Prompts the user for tests scaffolding configuration.
 * Returns a ready-to-use TestsConfig.
 */
export const promptForTestsConfig = async (): Promise<TestsConfig> => {
  const repository = await input({
    message: 'Tests scaffolding repository:',
    default: DEFAULT_SCAFFOLDING_REPOSITORY,
  });

  const path = await input({
    message: 'Scaffolding path within repository:',
    default: DEFAULT_SCAFFOLDING_PATH,
  });

  const version = await input({
    message: 'Scaffolding version (Git ref or "latest"):',
    default: DEFAULT_SCAFFOLDING_VERSION,
  });

  return {
    scaffolding: { repository, path, version },
  };
};

/**
 * Assembles a full JahiaCliConfig from the individually collected sections.
 */
export const assembleConfig = (
  environment: EnvironmentConfig,
  tests: TestsConfig,
): JahiaCliConfig => ({
  environment,
  tests,
  workflow: buildSampleWorkflow(),
});

/**
 * Builds the final success message shown after init completes.
 */
export const buildInitSuccessMessage = (configPath: string): string =>
  [
    `✓ Configuration created at ${configPath}`,
    '',
    '  Next steps:',
    `    Review and edit:     ${configPath}`,
    `    Create environment:  jahia-cli environment create --config ${configPath}`,
    `    Run workflow:        jahia-cli workflow run --config ${configPath}`,
  ].join('\n');

export default class Init extends Command {
  static override description =
    'Interactive onboarding wizard that creates a complete Jahia CLI configuration file. ' +
    'Guides you through environment, tests, and workflow setup with sensible defaults — ' +
    'press Enter to accept all defaults for a working setup.';

  static override examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init --json',
  ];

  static override flags = {
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    if (!flags.json) {
      this.log('');
      this.log('  Welcome to Jahia CLI! Let\'s create your configuration.');
      this.log('  Press Enter to accept the default value for each prompt.');
      this.log('');
    }

    // Step 1: Config file location
    if (!flags.json) {
      this.log('  ── Configuration File ──');
    }

    const configPath = await promptForConfigPath();

    // Step 2: Environment setup
    if (!flags.json) {
      this.log('');
      this.log('  ── Environment ──');
    }

    const environment = await promptForEnvironmentConfig();

    // Step 3: Tests scaffolding
    if (!flags.json) {
      this.log('');
      this.log('  ── Tests Scaffolding ──');
    }

    const tests = await promptForTestsConfig();

    // Step 4: Workflow (non-interactive — just include sample)
    if (!flags.json) {
      this.log('');
      this.log('  ── Workflow ──');
      this.log('  Adding sample workflow (init → create → alive → test → cleanup)');
    }

    // Assemble and write
    const config = assembleConfig(environment, tests);
    const yamlContent = configToYamlWithComments(config);
    await writeFile(configPath, yamlContent, 'utf-8');

    if (flags.json) {
      this.log(
        JSON.stringify(
          { success: true, file: configPath, config },
          undefined,
          2,
        ),
      );
    } else {
      this.log('');
      this.log(buildInitSuccessMessage(configPath));
    }

    // Step 5: Offer to run the workflow
    if (!flags.json) {
      this.log('');
      const runWorkflow = await confirm({
        message: 'Run the sample workflow now?',
        default: false,
      });

      if (runWorkflow) {
        this.log('');
        await this.config.runCommand('workflow:run', ['--config', configPath]);
      }
    }
  }
}
