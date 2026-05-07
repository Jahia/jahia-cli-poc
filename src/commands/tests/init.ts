import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Args, Command, Flags } from '@oclif/core';

import { buildBlankConfig } from '../../lib/config/build-blank-config.js';
import { initializeConfigFile } from '../../lib/config/initialize-config-file.js';
import { withTestsVersion } from '../../lib/config/with-tests-version.js';
import { cloneScaffolding } from '../../lib/tests/clone-scaffolding.js';
import { syncMissingFiles } from '../../lib/tests/sync-missing-files.js';
import type { SyncMissingFilesResult } from '../../lib/tests/types.js';

const DEFAULT_TESTS_PATH = 'tests';
const DEFAULT_CONFIG_FILE = 'jahia-cli.config.yml';

export const formatTestsInitHuman = (params: {
  readonly version: string;
  readonly destinationPath: string;
  readonly repositoryUrl: string;
  readonly result: SyncMissingFilesResult;
  readonly configFile: string;
  readonly configCreated: boolean;
}): string => {
  const lines = [
    '✓ Test scaffolding initialized',
    `  Version:      ${params.version}`,
    `  Source:       ${params.repositoryUrl}`,
    `  Destination:  ${params.destinationPath}`,
    `  Copied:       ${String(params.result.copied.length)}`,
    `  Kept:         ${String(params.result.kept.length)}`,
    `  Config:       ${params.configFile} (${params.configCreated ? 'created' : 'updated'})`,
  ];

  return lines.join('\n');
};

export const buildTestsInitSuccessJson = (params: {
  readonly requestedVersion?: string | undefined;
  readonly version: string;
  readonly destinationPath: string;
  readonly repositoryUrl: string;
  readonly result: SyncMissingFilesResult;
  readonly configFile: string;
  readonly configCreated: boolean;
}): string =>
  JSON.stringify(
    {
      success: true,
      requestedVersion: params.requestedVersion,
      version: params.version,
      source: params.repositoryUrl,
      destination: params.destinationPath,
      copiedCount: params.result.copied.length,
      keptCount: params.result.kept.length,
      copied: params.result.copied,
      kept: params.result.kept,
      configFile: params.configFile,
      configCreated: params.configCreated,
    },
    null,
    2,
  );

export const buildTestsInitFailureJson = (params: {
  readonly requestedVersion?: string | undefined;
  readonly destinationPath: string;
  readonly message: string;
}): string =>
  JSON.stringify(
    {
      success: false,
      error: 'tests_init_failed',
      requestedVersion: params.requestedVersion,
      destination: params.destinationPath,
      message: params.message,
    },
    null,
    2,
  );

export default class TestsInit extends Command {
  static override description =
    'Initialize local test scaffolding from jahia-cypress. ' +
    'Copies files from scaffolding/ only when they are missing locally.';

  static override examples = [
    '<%= config.bin %> tests init',
    '<%= config.bin %> tests init test-jahia-cli',
    '<%= config.bin %> tests init v1.2.3 ./tests',
    '<%= config.bin %> tests init --path ./tests --json',
  ];

  static override args = {
    version: Args.string({
      required: false,
      description: 'Branch or tag to fetch from Jahia/jahia-cypress (defaults to latest tag)',
    }),
    path: Args.string({
      required: false,
      description: `Path to local tests folder (default: ${DEFAULT_TESTS_PATH})`,
    }),
  };

  static override flags = {
    path: Flags.string({
      char: 'p',
      description: `Path to local tests folder (default: ${DEFAULT_TESTS_PATH})`,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(TestsInit);
    const destinationPath = resolve(flags.path ?? args.path ?? DEFAULT_TESTS_PATH);
    const configFile = resolve(DEFAULT_CONFIG_FILE);
    const tempDir = await mkdtemp(join(tmpdir(), 'jahia-cli-tests-init-'));

    try {
      const cloned = await cloneScaffolding({
        version: args.version,
        workDir: tempDir,
      });

      const result = await syncMissingFiles({
        sourceDir: cloned.scaffoldingDir,
        destinationDir: destinationPath,
      });

      const config = withTestsVersion(buildBlankConfig(), cloned.version);
      const initializedConfig = await initializeConfigFile({
        outputFile: configFile,
        config,
        force: false,
      });

      if (flags.json) {
        this.log(
          buildTestsInitSuccessJson({
            requestedVersion: args.version,
            version: cloned.version,
            destinationPath,
            repositoryUrl: cloned.repositoryUrl,
            result,
            configFile,
            configCreated: initializedConfig.written,
          }),
        );
      } else {
        this.log(
          formatTestsInitHuman({
            version: cloned.version,
            destinationPath,
            repositoryUrl: cloned.repositoryUrl,
            result,
            configFile,
            configCreated: initializedConfig.written,
          }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(
          buildTestsInitFailureJson({
            requestedVersion: args.version,
            destinationPath,
            message,
          }),
        );
      } else {
        this.error(message);
      }
      this.exit(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
