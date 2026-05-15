import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { detectManifestSource } from '../../lib/provisioning/detect-manifest-source.js';
import { fetchManifest } from '../../lib/provisioning/fetch-manifest.js';
import { filterFiles } from '../../lib/provisioning/filter-files.js';
import { readManifest } from '../../lib/provisioning/read-manifest.js';
import { resolveAssetPaths } from '../../lib/provisioning/resolve-asset-paths.js';
import type { FileActionType } from '../../lib/provisioning/submit-file-action.js';
import { submitFileAction } from '../../lib/provisioning/submit-file-action.js';
import { submitProvisioning } from '../../lib/provisioning/submit-provisioning.js';
import type { FileActionResult, ProvisioningAttachment } from '../../lib/provisioning/types.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { resolveJahiaConnection } from '../../lib/state/get-jahia-connection-defaults.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { formatUrlSourceLabel } from './alive.js';

/**
 * Detected provisioning mode based on provided flags.
 */
export type ProvisionMode = 'manifest' | 'modules' | 'scripts';

/**
 * Reads file attachments from disk and returns them as ProvisioningAttachment objects.
 */
export const loadAttachments = async (
  filePaths: readonly string[],
): Promise<readonly ProvisioningAttachment[]> => {
  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readFile(filePath);
      return { filename: basename(filePath), content };
    }),
  );
  return results;
};

/**
 * Formats a provisioning result for human-readable output.
 */
export const formatProvisioningResultHuman = (result: {
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly responseBody: unknown;
  readonly manifest: string;
  readonly durationMs: number;
}): string => {
  const icon = result.success ? '✓' : '✗';
  const status = result.success ? 'Provisioning succeeded' : 'Provisioning failed';
  const lines = [
    `${icon} ${status}`,
    `  Manifest:  ${result.manifest}`,
    `  Status:    HTTP ${String(result.statusCode)}`,
    `  Duration:  ${String(result.durationMs)}ms`,
  ];

  if (result.responseBody !== undefined) {
    lines.push('');
    lines.push(JSON.stringify(result.responseBody, null, 2));
  } else if (!result.success && result.message) {
    lines.push(`  Error:     ${result.message}`);
  }

  return lines.join('\n');
};

/**
 * Formats a single file action result for human-readable output.
 */
export const formatFileActionResult = (result: FileActionResult): string => {
  const icon = result.success ? '✓' : '✗';
  const status = result.success ? 'succeeded' : 'failed';
  return `  ${icon} ${result.filename} — ${status} (HTTP ${String(result.statusCode)}, ${String(result.durationMs)}ms)`;
};

/**
 * Detects the provisioning mode from provided flags.
 * Exactly one of manifest, modules, or scripts must be provided.
 */
export const detectProvisionMode = (flags: {
  readonly manifest: string | undefined;
  readonly modules: string | undefined;
  readonly scripts: string | undefined;
}): ProvisionMode => {
  const modes: readonly ProvisionMode[] = [
    ...(flags.manifest !== undefined ? (['manifest'] as const) : []),
    ...(flags.modules !== undefined ? (['modules'] as const) : []),
    ...(flags.scripts !== undefined ? (['scripts'] as const) : []),
  ];

  if (modes.length === 0) {
    throw new Error('One of --manifest, --modules, or --scripts is required.');
  }

  if (modes.length > 1) {
    throw new Error('Only one of --manifest, --modules, or --scripts can be specified at a time.');
  }

  const mode = modes[0];
  if (mode === undefined) {
    throw new Error('One of --manifest, --modules, or --scripts is required.');
  }

  return mode;
};

/**
 * Validates flag combinations for cross-flag business rules.
 */
export const validateFlagCombinations = (
  mode: ProvisionMode,
  flags: {
    readonly assets: string | undefined;
    readonly file: readonly string[] | undefined;
    readonly filter: string | undefined;
  },
): void => {
  if (mode !== 'manifest' && flags.assets !== undefined) {
    throw new Error('--assets can only be used with --manifest mode.');
  }

  if (mode !== 'manifest' && flags.file !== undefined && flags.file.length > 0) {
    throw new Error('--file can only be used with --manifest mode.');
  }

  if (flags.filter !== undefined && mode === 'manifest' && flags.assets === undefined) {
    throw new Error('--filter requires --assets when used with --manifest mode.');
  }
};

export default class JahiaProvision extends Command {
  static override description =
    'Execute provisioning operations against a running Jahia instance. ' +
    'Three modes are available (exactly one per invocation):\n' +
    '  --manifest: Submit a YAML provisioning manifest with optional file attachments.\n' +
    '  --modules:  Upload module files (JARs) from a directory, one at a time.\n' +
    '  --scripts:  Execute provisioning scripts from a directory, one at a time.\n' +
    'Use --filter to limit which files are processed (glob pattern, matched against filename).';

  static override examples = [
    '<%= config.bin %> jahia provision --manifest ./provisioning/setup.yaml',
    '<%= config.bin %> jahia provision --manifest ./setup.yaml --assets ./artifacts',
    '<%= config.bin %> jahia provision --manifest ./setup.yaml --assets ./artifacts --filter "*.jar"',
    '<%= config.bin %> jahia provision --modules ./modules/',
    '<%= config.bin %> jahia provision --modules ./modules/ --filter "*-SNAPSHOT.jar"',
    '<%= config.bin %> jahia provision --scripts ./scripts/',
    '<%= config.bin %> jahia provision --scripts ./scripts/ --filter "*.groovy"',
  ];

  static override flags = {
    state: stateFlag,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to a local YAML file or a public URL of the provisioning manifest',
      exclusive: ['modules', 'scripts'],
    }),
    modules: Flags.string({
      description: 'Path to a directory of module files to install (one at a time via installOrUpgradeBundle)',
      exclusive: ['manifest', 'scripts', 'assets', 'file'],
    }),
    scripts: Flags.string({
      description: 'Path to a directory of provisioning scripts to execute (one at a time via executeScript)',
      exclusive: ['manifest', 'modules', 'assets', 'file'],
    }),
    filter: Flags.string({
      description: 'Glob pattern to filter files in --assets, --modules, or --scripts directories (default: all files). Example: "*-SNAPSHOT.jar"',
    }),
    url: Flags.string({
      description: 'Jahia base URL (default: from state, or http://localhost:8080)',
    }),
    username: Flags.string({
      char: 'u',
      description: 'Jahia admin username (default: from state, or root)',
    }),
    password: Flags.string({
      char: 'P',
      description: 'Jahia admin password (default: from state, or root1234)',
    }),
    file: Flags.string({
      char: 'f',
      description: 'File attachment to include with --manifest (can be specified multiple times)',
      multiple: true,
    }),
    assets: Flags.string({
      char: 'a',
      description: 'Directory whose files are attached to the --manifest provisioning request',
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(JahiaProvision);
    const statePath = stateFilePath(flags.state);

    const env = await getActiveEnvironment(flags.state);
    const envName = env?.name ?? 'unknown';
    const connection = await resolveJahiaConnection(env, flags.url);
    const url = connection.url;
    const username = flags.username ?? connection.username;
    const password = flags.password ?? connection.password;
    const urlSourceLabel = formatUrlSourceLabel(connection.resolvedUrl.source, connection.resolvedUrl.networkMode);

    try {
      const mode = detectProvisionMode({
        manifest: flags.manifest,
        modules: flags.modules,
        scripts: flags.scripts,
      });

      validateFlagCombinations(mode, {
        assets: flags.assets,
        file: flags.file,
        filter: flags.filter,
      });

      if (mode === 'manifest') {
        await this.runManifestMode(flags, { url, username, password, envName, statePath, urlSourceLabel });
      } else {
        const dirPath = mode === 'modules' ? flags.modules : flags.scripts;
        if (dirPath === undefined) {
          throw new Error(`Missing directory path for --${mode} mode.`);
        }

        const actionType: FileActionType = mode === 'modules' ? 'module' : 'script';
        await this.runFileActionMode(dirPath, actionType, mode, flags, { url, username, password, envName, urlSourceLabel });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, environment: envName, stateFile: statePath, error: message }, null, 2));
      } else {
        this.log(`\n✗ ${message}`);
      }

      this.exit(1);
    }
  }

  private async runManifestMode(
    flags: {
      readonly manifest: string | undefined;
      readonly assets: string | undefined;
      readonly file: readonly string[] | undefined;
      readonly filter: string | undefined;
      readonly json: boolean;
      readonly state: string | undefined;
    },
    connection: {
      readonly url: string;
      readonly username: string;
      readonly password: string;
      readonly envName: string;
      readonly statePath: string;
      readonly urlSourceLabel: string;
    },
  ): Promise<void> {
    const manifest = flags.manifest;
    if (manifest === undefined) {
      throw new Error('--manifest is required in manifest mode.');
    }

    const source = detectManifestSource(manifest);

    if (!flags.json) {
      this.log(`Provisioning Jahia environment "${connection.envName}"...`);
      this.log(`  Manifest: ${manifest} (${source})`);
      this.log(`  URL:      ${connection.url} (${connection.urlSourceLabel})`);
      this.log(`  State:    ${connection.statePath}`);
      if (flags.file && flags.file.length > 0) {
        this.log(`  Files:    ${flags.file.join(', ')}`);
      }

      if (flags.assets) {
        this.log(`  Assets:   ${flags.assets}`);
      }

      this.log('');
    }

    if (!flags.json) {
      this.log(source === 'url' ? 'Downloading manifest...' : 'Reading manifest...');
    }

    const { content: manifestContent, filename: manifestFilename } =
      source === 'url'
        ? await fetchManifest(manifest)
        : await readManifest(manifest);

    const filePaths = flags.file ?? [];

    const assetsResult: { readonly paths: readonly string[]; readonly missing: boolean } =
      flags.assets !== undefined
        ? await resolveAssetPaths(flags.assets)
            .then((paths) => ({ paths, missing: false }))
            .catch((error: unknown) => {
              const isNotFound =
                error instanceof Error &&
                'code' in error &&
                (error as NodeJS.ErrnoException).code === 'ENOENT';
              if (isNotFound) {
                return { paths: [] as readonly string[], missing: true };
              }

              throw error;
            })
        : { paths: [], missing: false };

    if (flags.assets !== undefined && assetsResult.paths.length === 0 && !flags.json) {
      this.log(
        assetsResult.missing
          ? `  ℹ Assets directory "${flags.assets}" does not exist — skipping attachments.`
          : `  ℹ Assets directory "${flags.assets}" is empty — skipping attachments.`,
      );
    }

    const assetPaths = flags.filter !== undefined
      ? filterFiles(assetsResult.paths, flags.filter)
      : assetsResult.paths;
    const allPaths = [...filePaths, ...assetPaths];
    const attachments = await loadAttachments(allPaths);

    if (!flags.json && attachments.length > 0) {
      this.log(`Attaching ${String(attachments.length)} file(s)...`);
    }

    if (!flags.json) {
      this.log('Submitting provisioning script...');
    }

    const result = await submitProvisioning({
      url: connection.url,
      username: connection.username,
      password: connection.password,
      manifestContent,
      manifestFilename,
      attachments,
    });

    if (flags.json) {
      this.log(JSON.stringify(
        { ...result, environment: connection.envName, stateFile: connection.statePath, source },
        null,
        2,
      ));
    } else {
      this.log('');
      this.log(formatProvisioningResultHuman(result));
    }

    if (!result.success) {
      this.exit(1);
    }
  }

  private async runFileActionMode(
    dirPath: string,
    actionType: FileActionType,
    mode: ProvisionMode,
    flags: { readonly filter: string | undefined; readonly json: boolean },
    connection: {
      readonly url: string;
      readonly username: string;
      readonly password: string;
      readonly envName: string;
      readonly urlSourceLabel: string;
    },
  ): Promise<void> {
    const dirResult = await resolveAssetPaths(dirPath)
      .then((paths) => ({ paths, missing: false }))
      .catch((error: unknown) => {
        const isNotFound =
          error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ENOENT';
        if (isNotFound) {
          return { paths: [] as readonly string[], missing: true };
        }

        throw error;
      });

    if (dirResult.missing) {
      const modeLabel = mode === 'modules' ? 'Modules' : 'Scripts';
      if (flags.json) {
        this.log(JSON.stringify({
          success: true,
          mode,
          directory: dirPath,
          filter: flags.filter ?? '*',
          filesMatched: 0,
          filesProcessed: 0,
          results: [],
          note: `${modeLabel} directory does not exist`,
        }, null, 2));
      } else {
        this.log(`  ℹ ${modeLabel} directory "${dirPath}" does not exist — nothing to process.`);
      }

      return;
    }

    const rawPaths = dirResult.paths;
    const filePaths = flags.filter !== undefined
      ? filterFiles(rawPaths, flags.filter)
      : [...rawPaths].sort((a, b) => basename(a).localeCompare(basename(b)));

    if (filePaths.length === 0) {
      const filterNote = flags.filter !== undefined ? ` matching "${flags.filter}"` : '';
      if (flags.json) {
        this.log(JSON.stringify({
          success: true,
          mode,
          directory: dirPath,
          filter: flags.filter ?? '*',
          filesMatched: 0,
          filesProcessed: 0,
          results: [],
        }, null, 2));
      } else {
        this.log(`No files found in "${dirPath}"${filterNote}. Nothing to do.`);
      }

      return;
    }

    const modeLabel = mode === 'modules' ? 'module' : 'script';
    if (!flags.json) {
      this.log(`▶ Uploading ${String(filePaths.length)} ${modeLabel}(s) from "${dirPath}"...`);
      this.log(`  URL: ${connection.url} (${connection.urlSourceLabel})`);
      if (flags.filter !== undefined) {
        this.log(`  Filter: ${flags.filter}`);
      }

      this.log('');
    }

    const results = await this.processFilesSequentially(filePaths, actionType, connection);

    const lastResult = results[results.length - 1];
    const hasFailed = lastResult !== undefined && !lastResult.success;

    if (!flags.json) {
      results.forEach((r) => {
        this.log(formatFileActionResult(r));
      });
    }

    if (hasFailed) {
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          mode,
          directory: dirPath,
          filter: flags.filter ?? '*',
          filesMatched: filePaths.length,
          filesProcessed: results.length,
          failedAt: lastResult.filename,
          results,
        }, null, 2));
      } else {
        this.log(`\n✗ Stopped after failure on "${lastResult.filename}".`);
      }

      this.exit(1);
      return;
    }

    if (flags.json) {
      this.log(JSON.stringify({
        success: true,
        mode,
        directory: dirPath,
        filter: flags.filter ?? '*',
        filesMatched: filePaths.length,
        filesProcessed: results.length,
        results,
      }, null, 2));
    } else {
      this.log(`\n✓ All ${String(results.length)} ${modeLabel}(s) processed successfully.`);
    }
  }

  /**
   * Processes files sequentially, stopping on the first failure.
   * Returns all results up to and including the failed one (if any).
   */
  private async processFilesSequentially(
    filePaths: readonly string[],
    actionType: FileActionType,
    connection: {
      readonly url: string;
      readonly username: string;
      readonly password: string;
    },
  ): Promise<readonly FileActionResult[]> {
    const processNext = async (
      remaining: readonly string[],
      accumulated: readonly FileActionResult[],
    ): Promise<readonly FileActionResult[]> => {
      const nextPath = remaining[0];
      if (nextPath === undefined) {
        return accumulated;
      }

      const content = await readFile(nextPath);
      const filename = basename(nextPath);

      const result = await submitFileAction({
        url: connection.url,
        username: connection.username,
        password: connection.password,
        filename,
        content,
        actionType,
      });

      const updated = [...accumulated, result];

      if (!result.success) {
        return updated;
      }

      return processNext(remaining.slice(1), updated);
    };

    return processNext(filePaths, []);
  }
}
