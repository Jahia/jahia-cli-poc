import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { buildBlankConfig } from '../../lib/config/build-blank-config.js';
import {
  DEFAULT_SCAFFOLDING_PATH,
  DEFAULT_SCAFFOLDING_REPOSITORY,
  DEFAULT_SCAFFOLDING_VERSION,
} from '../../lib/config/defaults.js';
import { initializeConfigFile } from '../../lib/config/initialize-config-file.js';
import { loadConfigFile } from '../../lib/config/parser.js';
import type { ScaffoldingConfig } from '../../lib/config/types.js';
import { cloneScaffolding } from '../../lib/tests/clone-scaffolding.js';
import { extractManagedEntries, updateGitignore } from '../../lib/tests/gitignore-manager.js';
import { syncMissingFiles } from '../../lib/tests/sync-missing-files.js';
import type { SyncAction, SyncMissingFilesResult } from '../../lib/tests/types.js';

const DEFAULT_CONFIG_FILE = 'jahia-cli.config.yml';

/**
 * Resolves ScaffoldingConfig from the loaded config, falling back to defaults.
 */
export const resolveScaffoldingConfig = (
  scaffolding: ScaffoldingConfig | undefined,
): ScaffoldingConfig => ({
  repository: scaffolding?.repository ?? DEFAULT_SCAFFOLDING_REPOSITORY,
  path: scaffolding?.path ?? DEFAULT_SCAFFOLDING_PATH,
  version: scaffolding?.version ?? DEFAULT_SCAFFOLDING_VERSION,
});

/**
 * Formats a single sync action line for human-readable output.
 */
export const formatSyncLine = (action: SyncAction, path: string, reason: string): string => {
  const labels: Record<SyncAction, string> = {
    copied: '  SYNC:   ',
    kept: '  SKIP:   ',
    ignored: '  IGNORED:',
    overwritten: '  FORCE:  ',
  };
  return `${labels[action]} ${path} (${reason})`;
};

/**
 * Builds human-readable output for the tests init command.
 */
export const formatTestsInitHuman = (params: {
  readonly version: string;
  readonly destinationPath: string;
  readonly repositoryUrl: string;
  readonly scaffoldingPath: string;
  readonly result: SyncMissingFilesResult;
  readonly configFile: string;
  readonly configCreated: boolean;
  readonly gitignoreEntriesAdded: number;
  readonly logLines: readonly string[];
}): string => {
  const lines = [
    ...params.logLines,
    '',
    `Summary: ${String(params.result.copied.length)} synced, ${String(params.result.overwritten.length)} overwritten, ${String(params.result.kept.length)} skipped, ${String(params.result.ignored.length)} ignored`,
    params.gitignoreEntriesAdded > 0
      ? `.gitignore updated: ${String(params.gitignoreEntriesAdded)} entries in managed section`
      : '.gitignore: no new entries needed',
    `✓ Test scaffolding initialized (${params.version})`,
  ];
  return lines.join('\n');
};

/**
 * Builds structured JSON output for AI agents and scripting.
 */
export const buildTestsInitSuccessJson = (params: {
  readonly version: string;
  readonly destinationPath: string;
  readonly repositoryUrl: string;
  readonly scaffoldingPath: string;
  readonly result: SyncMissingFilesResult;
  readonly configFile: string;
  readonly configCreated: boolean;
  readonly gitignoreEntriesAdded: number;
}): string =>
  JSON.stringify(
    {
      success: true,
      version: params.version,
      repository: params.repositoryUrl,
      scaffoldingPath: params.scaffoldingPath,
      destination: params.destinationPath,
      synced: params.result.copied,
      overwritten: params.result.overwritten,
      skipped: params.result.kept,
      ignored: params.result.ignored,
      gitignoreUpdated: params.gitignoreEntriesAdded > 0,
      gitignoreEntriesAdded: params.gitignoreEntriesAdded,
      configFile: params.configFile,
      configCreated: params.configCreated,
    },
    null,
    2,
  );

/**
 * Builds structured JSON failure output.
 */
export const buildTestsInitFailureJson = (params: {
  readonly destinationPath: string;
  readonly message: string;
}): string =>
  JSON.stringify(
    {
      success: false,
      error: 'tests_init_failed',
      destination: params.destinationPath,
      message: params.message,
    },
    null,
    2,
  );

export default class TestsInit extends Command {
  static override description =
    'Initialize local test scaffolding from a remote repository. ' +
    'Syncs missing files from the configured scaffolding source and manages .gitignore ' +
    'so that remotely-sourced files are not accidentally committed.';

  static override examples = [
    '<%= config.bin %> tests init',
    '<%= config.bin %> tests init --force',
    '<%= config.bin %> tests init --config ./my-config.yml',
    '<%= config.bin %> tests init --path ./tests --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: `Path to config file (default: ${DEFAULT_CONFIG_FILE})`,
      env: 'JAHIA_CLI_CONFIG',
    }),
    path: Flags.string({
      char: 'p',
      description: 'Override destination directory for scaffolding files',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing files that are managed by scaffolding (listed in .gitignore)',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(TestsInit);
    const configFile = resolve(flags.config ?? DEFAULT_CONFIG_FILE);
    const destinationPath = resolve(flags.path ?? '.');
    const gitignorePath = join(destinationPath, '.gitignore');
    const tempDir = await mkdtemp(join(tmpdir(), 'jahia-cli-tests-init-'));
    const logLines: string[] = [];

    try {
      // Load or generate config
      const configExists = await access(configFile).then(() => true).catch(() => false);

      const configCreated = !configExists;
      if (!configExists) {
        this.log(`Config not found at ${configFile}, generating blank...`);
        logLines.push(`Config not found at ${configFile}, generating blank...`);
        const blank = buildBlankConfig();
        await initializeConfigFile({ outputFile: configFile, config: blank, force: false });
      }

      const config = await loadConfigFile(configFile);
      const scaffolding = resolveScaffoldingConfig(config.scaffolding);

      logLines.push(`Loading config from ${configFile}...`);
      logLines.push(`Repository: ${scaffolding.repository}`);
      logLines.push(`Scaffolding path: ${scaffolding.path}`);
      logLines.push(`Version: ${scaffolding.version}`);

      // Resolve version and clone
      const resolvedVersion = scaffolding.version === 'latest' ? undefined : scaffolding.version;
      logLines.push(
        scaffolding.version === 'latest'
          ? `Resolving latest tag for ${scaffolding.repository}...`
          : `Using version: ${scaffolding.version}`,
      );

      const cloned = await cloneScaffolding({
        version: resolvedVersion,
        workDir: tempDir,
        repositoryUrl: scaffolding.repository.endsWith('.git')
          ? scaffolding.repository
          : `${scaffolding.repository}.git`,
        scaffoldingPath: scaffolding.path.replace(/\/$/, ''),
      });

      logLines.push(`Resolved version: ${cloned.version}`);
      logLines.push(`Cloning ${scaffolding.repository}@${cloned.version}...`);
      logLines.push(`Syncing ${scaffolding.path} → ${destinationPath}`);
      logLines.push('');

      // Load managed entries from .gitignore when force is requested
      const managedPaths = flags.force
        ? await extractManagedEntries(gitignorePath)
        : new Set<string>();

      // Sync files with per-file logging
      const result = await syncMissingFiles({
        sourceDir: cloned.scaffoldingDir,
        destinationDir: destinationPath,
        force: flags.force,
        managedPaths,
        logger: (action: SyncAction, relativePath: string, reason: string) => {
          logLines.push(formatSyncLine(action, relativePath, reason));
        },
      });

      // Update .gitignore with all remote-sourced files (copied + kept).
      // This ensures the managed section persists across re-runs — files stay
      // gitignored until the user manually removes the entry to "own" that file.
      const gitignoreResult = await updateGitignore(gitignorePath, [
        ...result.copied,
        ...result.kept,
        ...result.overwritten,
      ]);
      if (gitignoreResult.entriesAdded > 0) {
        logLines.push('');
        logLines.push(
          `.gitignore updated: ${String(gitignoreResult.entriesAdded)} entries added to managed section`,
        );
      }

      // Output
      if (flags.json) {
        this.log(
          buildTestsInitSuccessJson({
            version: cloned.version,
            destinationPath,
            repositoryUrl: scaffolding.repository,
            scaffoldingPath: scaffolding.path,
            result,
            configFile,
            configCreated,
            gitignoreEntriesAdded: gitignoreResult.entriesAdded,
          }),
        );
      } else {
        this.log(
          formatTestsInitHuman({
            version: cloned.version,
            destinationPath,
            repositoryUrl: scaffolding.repository,
            scaffoldingPath: scaffolding.path,
            result,
            configFile,
            configCreated,
            gitignoreEntriesAdded: gitignoreResult.entriesAdded,
            logLines,
          }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(buildTestsInitFailureJson({ destinationPath, message }));
      } else {
        this.error(message);
      }
      this.exit(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
