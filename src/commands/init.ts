import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { input, select } from '@inquirer/prompts';

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
import { listProviderNames } from '../lib/providers/index.js';
import { cloneEnvironmentScaffolding } from '../lib/environment/clone-environment-scaffolding.js';
import { parseServicesConfig } from '../lib/environment/parse-services-config.js';
import { discoverServices } from '../lib/environment/discover-services.js';
import { promptServiceSelection } from '../lib/environment/prompt-service-selection.js';
import { validateSelection } from '../lib/environment/validate-selection.js';
import { assembleComposeFile } from '../lib/environment/assemble-compose-file.js';
import { buildSampleWorkflows } from '../lib/workflow/build-sample-workflow.js';

const DEFAULT_CONFIG_FILENAME = 'jahia-cli.config.yml';
const DEFAULT_ENVIRONMENT_SCAFFOLDING_PATH = 'scaffolding/environment';

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
 * Prompts the user for environment scaffolding source configuration.
 */
export const promptForEnvironmentScaffolding = async (): Promise<{
  readonly repository: string;
  readonly path: string;
  readonly version: string;
}> => {
  const repository = await input({
    message: 'Environment scaffolding repository:',
    default: DEFAULT_SCAFFOLDING_REPOSITORY,
  });

  const path = await input({
    message: 'Environment scaffolding path within repository:',
    default: DEFAULT_ENVIRONMENT_SCAFFOLDING_PATH,
  });

  const version = await input({
    message: 'Environment scaffolding version (Git ref or "latest"):',
    default: DEFAULT_SCAFFOLDING_VERSION,
  });

  return { repository, path, version };
};

/**
 * Prompts the user for provider selection.
 */
export const promptForProvider = async (): Promise<string> => {
  const providers = listProviderNames();
  const choices = providers.map((p) => ({ name: p, value: p }));

  const selected = await select({
    message: 'Environment provider:',
    choices,
    default: DEFAULT_PROVIDER,
  });

  return selected;
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
  workflows: buildSampleWorkflows(),
});

/**
 * Builds the final success message shown after init completes.
 */
export const buildInitSuccessMessage = (configPath: string, composePath: string): string =>
  [
    `✓ Configuration created at ${configPath}`,
    `✓ Docker Compose file at ${composePath}`,
    '',
    '  Next steps:',
    `    Review and edit:     ${configPath}`,
    `    Create environment:  jahia-cli environment create --config ${configPath}`,
    `    Or directly:         docker compose -f ${composePath} up -d`,
  ].join('\n');

export default class Init extends Command {
  static override description =
    'Interactive onboarding wizard that creates a complete Jahia CLI configuration file. ' +
    'Guides you through scaffolding, provider selection, and service composition — ' +
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

    // Step 2: Tests scaffolding
    if (!flags.json) {
      this.log('');
      this.log('  ── Tests Scaffolding ──');
    }

    const tests = await promptForTestsConfig();

    // Step 3: Environment scaffolding — fetch it
    if (!flags.json) {
      this.log('');
      this.log('  ── Environment Scaffolding ──');
    }

    const envScaffolding = await promptForEnvironmentScaffolding();
    const tempDir = await mkdtemp(join(tmpdir(), 'jahia-cli-init-'));

    try {
      if (!flags.json) {
        this.log('  Fetching environment scaffolding...');
      }

      const resolvedVersion = envScaffolding.version === 'latest' ? undefined : envScaffolding.version;
      const repositoryUrl = envScaffolding.repository.endsWith('.git')
        ? envScaffolding.repository
        : `${envScaffolding.repository}.git`;

      const cloned = await cloneEnvironmentScaffolding({
        version: resolvedVersion,
        workDir: tempDir,
        repositoryUrl,
        scaffoldingPath: envScaffolding.path,
      });

      if (!flags.json) {
        this.log(`  ✓ Fetched scaffolding (${cloned.version})`);
      }

      // Step 4: Provider selection
      if (!flags.json) {
        this.log('');
        this.log('  ── Provider ──');
      }

      const provider = await promptForProvider();

      // Step 5: Service selection (docker provider only)
      const composePath: string | undefined = provider === 'docker'
        ? await (async (): Promise<string> => {
          if (!flags.json) {
            this.log('');
            this.log('  ── Service Selection ──');
          }

          // Read config.yml from scaffolding
          const configYmlPath = join(cloned.servicesDir, 'config.yml');
          const configYmlContent = await readFile(configYmlPath, 'utf-8');
          const servicesConfig = parseServicesConfig(configYmlContent);

          // Discover available services
          const services = await discoverServices(cloned.servicesDir);

          // Prompt for selection per group
          const selections = await promptServiceSelection({
            groups: servicesConfig,
            services,
            onInfo: flags.json ? undefined : (msg: string): void => { this.log(msg); },
          });

          // Validate dependencies
          const errors = validateSelection(selections);
          if (errors.length > 0) {
            const msg = `Service dependency validation failed:\n${errors.map((e) => `  • ${e}`).join('\n')}`;
            if (flags.json) {
              this.log(JSON.stringify({ success: false, error: 'validation_failed', message: msg }));
            } else {
              this.error(msg);
            }
            throw new Error('validation_failed');
          }

          // Determine compose file location
          const configDir = resolve(configPath, '..');
          const envDir = join(configDir, 'environment');
          const path = join(envDir, 'docker-compose.yml');

          // Copy services from scaffolding to local environment directory
          const { copyDir } = await import('../lib/environment/copy-scaffolding-to-local.js');
          await copyDir(cloned.environmentDir, envDir);

          // Assemble the docker-compose.yml with selected services
          const composeContent = assembleComposeFile(selections);
          await writeFile(path, composeContent, 'utf-8');

          if (!flags.json) {
            this.log('');
            this.log(`  ✓ Docker Compose file assembled with ${String(selections.length)} service(s)`);
          }

          return path;
        })()
        : undefined;

      if (composePath === undefined && provider === 'docker') {
        return;
      }

      // Step 6: Environment name
      const envName = generateEnvName();

      // Assemble and write config
      const environment: EnvironmentConfig = {
        name: envName,
        provider,
        composePath,
        scaffolding: {
          repository: envScaffolding.repository,
          path: envScaffolding.path,
          version: cloned.version,
        },
      };

      const config = assembleConfig(environment, tests);
      const yamlContent = configToYamlWithComments(config);
      await writeFile(configPath, yamlContent, 'utf-8');

      if (flags.json) {
        this.log(
          JSON.stringify(
            { success: true, file: configPath, composePath, config },
            undefined,
            2,
          ),
        );
      } else {
        this.log('');
        this.log(buildInitSuccessMessage(configPath, composePath ?? 'N/A'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'init_failed', message }));
      } else {
        this.error(message);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
