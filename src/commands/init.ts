import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
import { parseServicesConfig } from '../lib/environment/parse-services-config.js';
import { discoverServices } from '../lib/environment/discover-services.js';
import { assembleComposeFile } from '../lib/environment/assemble-compose-file.js';
import { collectFilePaths } from '../lib/environment/collect-file-paths.js';
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
  readonly testFilesSynced: number;
  readonly environmentFilesSynced: number;
}): string =>
  [
    `✓ Scaffolding refreshed from config (${params.version})`,
    `  • Test files synced: ${String(params.testFilesSynced)}`,
    `  • Environment files synced: ${String(params.environmentFilesSynced)}`,
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

      // Sync test files (excludes environment/)
      const managedPaths = flags.force
        ? await extractManagedEntries(gitignorePath)
        : new Set<string>();

      const syncResult = await syncMissingFiles({
        sourceDir: cloned.scaffoldingDir,
        destinationDir: configDir,
        managedPaths,
        force: flags.force,
        skipDirectories: ['environment'],
      });

      if (!flags.json) {
        this.log(`  ✓ Synced ${String(syncResult.copied.length)} test file(s)`);
      }

      // Sync environment files if compose path exists in config
      const environmentDir = join(cloned.scaffoldingDir, 'environment');
      const envDir = join(configDir, 'environment');

      const environmentFileCount: number =
        existingConfig.environment?.composePath !== undefined
          ? await (async (): Promise<number> => {
              const { copyDir } = await import('../lib/environment/copy-scaffolding-to-local.js');
              await copyDir(environmentDir, envDir);

              // Re-assemble compose file from existing services selection
              const servicesDir = join(environmentDir, 'services');
              const configYmlPath = join(servicesDir, 'config.yml');
              const configYmlContent = await readFile(configYmlPath, 'utf-8');
              const servicesConfig = parseServicesConfig(configYmlContent);

              // Discover services and select the ones that match existing includes
              const services = await discoverServices(servicesDir);
              const alwaysIncluded = services.filter(
                (s) => servicesConfig.groups[s.metadata.group]?.selection === 'always_included',
              );

              // Read current compose file to detect which services are already included
              const existingComposePath = resolve(
                configDir,
                existingConfig.environment?.composePath ?? '',
              );
              const existingCompose = await readFile(existingComposePath, 'utf-8').catch(() => '');
              const currentlyIncluded = services.filter((s) =>
                existingCompose.includes(s.filename),
              );

              // Use current selections if compose already exists, otherwise just always_included
              const selections = currentlyIncluded.length > 0 ? currentlyIncluded : alwaysIncluded;

              const composeContent = assembleComposeFile(selections);
              await writeFile(existingComposePath, composeContent, 'utf-8');

              const envFiles = await collectFilePaths(envDir, configDir);

              if (!flags.json) {
                this.log(`  ✓ Synced ${String(envFiles.length)} environment file(s)`);
              }

              return envFiles.length;
            })()
          : 0;

      // Update .gitignore
      const testManagedPaths = [
        ...syncResult.copied,
        ...syncResult.kept,
        ...syncResult.overwritten,
      ];

      const environmentManagedPaths: readonly string[] =
        environmentFileCount > 0 ? await collectFilePaths(envDir, configDir) : [];

      await updateGitignore(gitignorePath, [...testManagedPaths, ...environmentManagedPaths]);

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              success: true,
              mode: 'refresh',
              configPath,
              version: cloned.version,
              testFilesSynced: syncResult.copied.length,
              environmentFilesSynced: environmentFileCount,
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
            testFilesSynced: syncResult.copied.length,
            environmentFilesSynced: environmentFileCount,
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

      // Clone the full scaffolding (contains both tests at root and environment/ subdir)
      const cloned = await cloneScaffolding({
        version: resolvedVersion,
        workDir: tempDir,
        repositoryUrl,
        scaffoldingPath: scaffolding.path.replace(/\/$/, ''),
      });

      if (!flags.json) {
        this.log(`  ✓ Fetched scaffolding (${cloned.version})`);
      }

      // Sync test files from scaffolding root to destination directory
      // (excludes environment/ which is handled separately)
      const configDir = resolve(configPath, '..');
      const gitignorePath = join(configDir, '.gitignore');

      if (!flags.json) {
        this.log('  Syncing test scaffolding files...');
      }

      const managedPaths = await extractManagedEntries(gitignorePath);
      const syncResult = await syncMissingFiles({
        sourceDir: cloned.scaffoldingDir,
        destinationDir: configDir,
        managedPaths,
        skipDirectories: ['environment'],
      });

      if (!flags.json) {
        this.log(`  ✓ Synced ${String(syncResult.copied.length)} test file(s)`);
      }

      // Step 3: Provider selection
      if (!flags.json) {
        this.log('');
        this.log('  ── Provider ──');
      }

      const provider = await promptForProvider();

      // Step 4: Environment setup (docker provider only — auto-selects always_included services)
      const environmentDir = join(cloned.scaffoldingDir, 'environment');
      const servicesDir = join(environmentDir, 'services');

      const composePath: string | undefined =
        provider === 'docker'
          ? await (async (): Promise<string> => {
              // Read config.yml from scaffolding
              const configYmlPath = join(servicesDir, 'config.yml');
              const configYmlContent = await readFile(configYmlPath, 'utf-8');
              const servicesConfig = parseServicesConfig(configYmlContent);

              // Discover available services and auto-select always_included ones
              const services = await discoverServices(servicesDir);
              const selections = services
                .filter(
                  (s) => servicesConfig.groups[s.metadata.group]?.selection === 'always_included',
                )
                .map((service) => ({ filename: service.filename, metadata: service.metadata }));

              if (!flags.json) {
                selections.forEach((s) => {
                  this.log(`  ✓ ${s.metadata.name} (auto-included)`);
                });
              }

              // Determine compose file location
              const envDir = join(configDir, 'environment');
              const path = join(envDir, 'docker-compose.yml');

              // Copy environment scaffolding (services) to local environment directory
              const { copyDir } = await import('../lib/environment/copy-scaffolding-to-local.js');
              await copyDir(environmentDir, envDir);

              // Assemble the docker-compose.yml with selected services
              const composeContent = assembleComposeFile(selections);
              await writeFile(path, composeContent, 'utf-8');

              if (!flags.json) {
                this.log('');
                this.log(
                  `  ✓ Docker Compose file assembled with ${String(selections.length)} service(s)`,
                );
              }

              return path;
            })()
          : undefined;

      if (composePath === undefined && provider === 'docker') {
        return;
      }

      // Update .gitignore with test files + environment files
      const testManagedPaths = [
        ...syncResult.copied,
        ...syncResult.kept,
        ...syncResult.overwritten,
      ];

      const environmentManagedPaths: readonly string[] =
        composePath !== undefined
          ? await collectFilePaths(join(configDir, 'environment'), configDir)
          : [];

      await updateGitignore(gitignorePath, [...testManagedPaths, ...environmentManagedPaths]);

      // Step 5: Environment name
      const envName = generateEnvName();

      // Assemble and write config
      const environment: EnvironmentConfig = {
        name: envName,
        provider,
        composePath,
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
        this.log(buildInitSuccessMessage(configPath, composePath ?? 'N/A'));

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
