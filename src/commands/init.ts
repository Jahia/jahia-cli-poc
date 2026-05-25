import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { confirm, input, select } from '@inquirer/prompts';

import { configToYamlWithComments } from '../lib/config/config-to-yaml-with-comments.js';
import {
  DEFAULT_PROVIDER,
  DEFAULT_SCAFFOLDING_PATH,
  DEFAULT_SCAFFOLDING_REPOSITORY,
  DEFAULT_SCAFFOLDING_VERSION,
  generateEnvName,
} from '../lib/config/defaults.js';
import type { EnvironmentConfig, JahiaCliConfig, ScaffoldingConfig } from '../lib/config/types.js';
import { loadConfigFile } from '../lib/config/load-config-file.js';
import { listProviderNames } from '../lib/providers/index.js';
import { cloneScaffolding } from '../lib/tests/clone-scaffolding.js';
import { syncMissingFiles } from '../lib/tests/sync-missing-files.js';
import { extractManagedEntries, updateGitignore } from '../lib/tests/gitignore-manager.js';
import { buildSampleWorkflows } from '../lib/workflow/build-sample-workflow.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../lib/debug/index.js';

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
 * Prompts the user for scaffolding configuration (single source for tests + environment).
 * Returns a ready-to-use ScaffoldingConfig.
 */
export const promptForScaffoldingConfig = async (): Promise<ScaffoldingConfig> => {
  const repository = await input({
    message: 'Scaffolding repository:',
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
  scaffolding: ScaffoldingConfig,
  environment: EnvironmentConfig,
): JahiaCliConfig => ({
  scaffolding,
  environment,
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
    '  To customize your environment, edit the files in the environment/ folder.',
    '',
    '  Next steps:',
    `    Review and edit:     ${configPath}`,
    `    Create environment:  jahia-cli environment create --config ${configPath}`,
    `    Or directly:         docker compose -f ${composePath} up -d`,
  ].join('\n');

/**
 * Resolves scaffolding config from a loaded config, falling back to defaults.
 */
export const resolveScaffoldingFromConfig = (
  scaffolding: ScaffoldingConfig | undefined,
): ScaffoldingConfig => ({
  repository: scaffolding?.repository ?? DEFAULT_SCAFFOLDING_REPOSITORY,
  path: scaffolding?.path ?? DEFAULT_SCAFFOLDING_PATH,
  version: scaffolding?.version ?? DEFAULT_SCAFFOLDING_VERSION,
});

/**
 * Builds the refresh success message shown after non-interactive init completes.
 */
export const buildRefreshSuccessMessage = (params: {
  readonly configPath: string;
  readonly version: string;
  readonly filesSynced: number;
}): string =>
  [
    `✓ Scaffolding refreshed from config (${params.version})`,
    `  • Files synced: ${String(params.filesSynced)}`,
    `  • .gitignore updated`,
    '',
    `  Config: ${params.configPath}`,
  ].join('\n');

export default class Init extends Command {
  static override description =
    'Interactive onboarding wizard that creates a complete Jahia CLI configuration file. ' +
    'When --config is provided, runs non-interactively: re-fetches scaffolding and syncs ' +
    'test + environment files from the remote source defined in the config.';

  static override examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init --config jahia-cli.config.yml',
    '<%= config.bin %> init -c jahia-cli.config.yml --force',
    '<%= config.bin %> init --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to existing config file — runs non-interactively, re-syncing scaffolding',
      env: 'JAHIA_CLI_CONFIG',
    }),
    force: Flags.boolean({
      char: 'f',
      description:
        'Overwrite existing files that are managed by scaffolding (listed in .gitignore)',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }

    if (flags.config !== undefined) {
      await this.runNonInteractive({ config: flags.config, force: flags.force, json: flags.json });
    } else {
      await this.runInteractive(flags);
    }
  }

  /**
   * Non-interactive mode: loads config, re-fetches scaffolding, syncs files.
   * Used by CI/CD pipelines and re-runs.
   */
  private async runNonInteractive(flags: {
    readonly config: string;
    readonly force: boolean;
    readonly json: boolean;
  }): Promise<void> {
    const configPath = resolve(flags.config);
    const configDir = resolve(configPath, '..');
    const gitignorePath = join(configDir, '.gitignore');
    const tempDir = await mkdtemp(join(tmpdir(), 'jahia-cli-init-'));

    try {
      const existingConfig = await loadConfigFile(configPath);
      const scaffolding = resolveScaffoldingFromConfig(existingConfig.scaffolding);

      if (!flags.json) {
        this.log('');
        this.log(`  Loading config from ${configPath}`);
        this.log(`  Repository: ${scaffolding.repository}`);
        this.log(`  Version: ${scaffolding.version}`);
        this.log('');
      }

      const resolvedVersion = scaffolding.version === 'latest' ? undefined : scaffolding.version;
      const repositoryUrl = scaffolding.repository.endsWith('.git')
        ? scaffolding.repository
        : `${scaffolding.repository}.git`;

      const cloned = await cloneScaffolding({
        version: resolvedVersion,
        workDir: tempDir,
        repositoryUrl,
        scaffoldingPath: scaffolding.path.replace(/\/$/, ''),
      });

      if (!flags.json) {
        this.log(`  Fetching scaffolding (${cloned.version})...`);
      }

      // Sync all scaffolding files (won't overwrite existing unless --force)
      const managedPaths = flags.force
        ? await extractManagedEntries(gitignorePath)
        : new Set<string>();

      const syncResult = await syncMissingFiles({
        sourceDir: cloned.scaffoldingDir,
        destinationDir: configDir,
        managedPaths,
        force: flags.force,
      });

      if (!flags.json) {
        this.log(`  ✓ Synced ${String(syncResult.copied.length)} file(s)`);
      }

      // Update .gitignore
      const allManagedPaths = [
        ...syncResult.copied,
        ...syncResult.kept,
        ...syncResult.overwritten,
      ];

      await updateGitignore(gitignorePath, allManagedPaths);

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              success: true,
              mode: 'refresh',
              configPath,
              version: cloned.version,
              filesSynced: syncResult.copied.length,
            },
            undefined,
            2,
          ),
        );
      } else {
        this.log('');
        this.log(
          buildRefreshSuccessMessage({
            configPath,
            version: cloned.version,
            filesSynced: syncResult.copied.length,
          }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'init_refresh_failed', message }));
      } else {
        this.error(message);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Interactive mode: prompts user for all settings and creates config from scratch.
   */
  private async runInteractive(flags: {
    readonly force: boolean;
    readonly json: boolean;
  }): Promise<void> {
    if (!flags.json) {
      this.log('');
      this.log("  Welcome to Jahia CLI! Let's create your configuration.");
      this.log('  Press Enter to accept the default value for each prompt.');
      this.log('');
    }

    // Step 1: Config file location
    if (!flags.json) {
      this.log('  ── Configuration File ──');
    }

    const configPath = await promptForConfigPath();

    // Step 2: Scaffolding (single source for tests + environment)
    if (!flags.json) {
      this.log('');
      this.log('  ── Scaffolding ──');
    }

    const scaffolding = await promptForScaffoldingConfig();
    const tempDir = await mkdtemp(join(tmpdir(), 'jahia-cli-init-'));

    try {
      if (!flags.json) {
        this.log('  Fetching scaffolding...');
      }

      const resolvedVersion = scaffolding.version === 'latest' ? undefined : scaffolding.version;
      const repositoryUrl = scaffolding.repository.endsWith('.git')
        ? scaffolding.repository
        : `${scaffolding.repository}.git`;

      const cloned = await cloneScaffolding({
        version: resolvedVersion,
        workDir: tempDir,
        repositoryUrl,
        scaffoldingPath: scaffolding.path.replace(/\/$/, ''),
      });

      if (!flags.json) {
        this.log(`  ✓ Fetched scaffolding (${cloned.version})`);
      }

      // Sync all scaffolding files to destination directory
      const configDir = resolve(configPath, '..');
      const gitignorePath = join(configDir, '.gitignore');

      if (!flags.json) {
        this.log('  Syncing scaffolding files...');
      }

      const managedPaths = await extractManagedEntries(gitignorePath);
      const syncResult = await syncMissingFiles({
        sourceDir: cloned.scaffoldingDir,
        destinationDir: configDir,
        managedPaths,
      });

      if (!flags.json) {
        this.log(`  ✓ Synced ${String(syncResult.copied.length)} file(s)`);
      }

      // Step 3: Provider selection
      if (!flags.json) {
        this.log('');
        this.log('  ── Provider ──');
      }

      const provider = await promptForProvider();

      // Compose path for docker provider
      const envDir = join(configDir, 'environment');
      const composePath = join(envDir, 'docker-compose.yml');

      // Update .gitignore with all synced files
      const allManagedPaths = [
        ...syncResult.copied,
        ...syncResult.kept,
        ...syncResult.overwritten,
      ];

      await updateGitignore(gitignorePath, allManagedPaths);

      // Step 5: Environment name
      const envName = generateEnvName();

      // Assemble and write config
      const environment: EnvironmentConfig = {
        name: envName,
        provider,
        composePath: provider === 'docker' ? composePath : undefined,
      };

      const resolvedScaffolding: ScaffoldingConfig = {
        repository: scaffolding.repository,
        path: scaffolding.path,
        version: cloned.version,
      };

      const config = assembleConfig(resolvedScaffolding, environment);
      const yamlContent = configToYamlWithComments(config);
      await writeFile(configPath, yamlContent, 'utf-8');

      if (flags.json) {
        this.log(
          JSON.stringify({ success: true, file: configPath, composePath, config }, undefined, 2),
        );
      } else {
        this.log('');
        this.log(buildInitSuccessMessage(configPath, composePath));

        // Offer to start the environment and run the default workflow
        this.log('');
        const shouldStart = await confirm({
          message: 'Start the environment and run the default workflow now?',
          default: true,
        });

        if (shouldStart) {
          this.log('');
          this.log('  ── Starting Environment ──');
          await this.config.runCommand('environment:create', ['--config', configPath, '--force']);

          this.log('');
          this.log('  ── Running Default Workflow ──');
          await this.config.runCommand('workflow:run', ['--config', configPath]);
        }
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
