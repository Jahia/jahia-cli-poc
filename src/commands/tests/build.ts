import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { execa } from 'execa';

import { loadConfigFile } from '../../lib/config/parser.js';
import {
  DEFAULT_DOCKERFILE,
  DEFAULT_IMAGE_NAME,
  buildBuildxArgs,
  parseKeyValueArgs,
  resolveImageTag,
} from '../../lib/tests/build-image.js';

/**
 * Resolves the scaffolding version from config, falling back to 'latest'.
 */
export const resolveVersion = (
  configVersion: string | undefined,
): string => configVersion ?? 'latest';

/**
 * Formats a human-readable build success message.
 */
export const formatBuildSuccess = (tag: string, dockerfile: string): string =>
  `✓ Test image built successfully: ${tag}\n  Dockerfile: ${dockerfile}`;

/**
 * Formats a human-readable build failure message.
 */
export const formatBuildFailure = (error: string): string =>
  `✗ Test image build failed\n  ${error}`;

export default class TestsBuild extends Command {
  static override description =
    'Build the test Docker image from Dockerfile.local using docker buildx. ' +
    'The image stays local (no push) and can be run with "tests run".';

  static override examples = [
    '<%= config.bin %> tests build -c config.yml',
    '<%= config.bin %> tests build -c config.yml --tag my-tests:v1',
    '<%= config.bin %> tests build -c config.yml --build-arg CYPRESS_VERSION=13.0.0',
    '<%= config.bin %> tests build -c config.yml --no-cache --platform linux/amd64',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to jahia-cli config file',
      required: true,
    }),
    dockerfile: Flags.string({
      char: 'd',
      description: `Path to the Dockerfile (default: ${DEFAULT_DOCKERFILE})`,
    }),
    tag: Flags.string({
      char: 't',
      description: `Image tag (default: ${DEFAULT_IMAGE_NAME}:VERSION from config)`,
    }),
    'build-arg': Flags.string({
      description: 'Additional build arg (KEY=VALUE, repeatable). Supports ${VAR:-default} substitution.',
      multiple: true,
    }),
    platform: Flags.string({
      description: 'Target platform (e.g. linux/amd64). Defaults to current platform.',
    }),
    'no-cache': Flags.boolean({
      description: 'Build without using cache',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(TestsBuild);

    try {
      const config = await loadConfigFile(resolve(flags.config));
      const version = resolveVersion(config.tests?.scaffolding?.version);
      const dockerfile = flags.dockerfile ?? DEFAULT_DOCKERFILE;
      const tag = flags.tag ?? resolveImageTag(DEFAULT_IMAGE_NAME, version);

      const extraBuildArgs = flags['build-arg'] !== undefined
        ? parseKeyValueArgs(flags['build-arg'])
        : undefined;

      const args = buildBuildxArgs({
        dockerfile,
        tag,
        baseVersion: version,
        platform: flags.platform,
        noCache: flags['no-cache'],
        extraBuildArgs,
      });

      if (!flags.json) {
        this.log(`Building test image: ${tag}`);
        this.log(`  Dockerfile: ${dockerfile}`);
        this.log(`  BASE_VERSION: ${version}`);
      }

      await execa('docker', [...args], { stdio: 'inherit' });

      if (flags.json) {
        this.log(JSON.stringify({ success: true, tag, dockerfile, version }, null, 2));
      } else {
        this.log(formatBuildSuccess(tag, dockerfile));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: message }, null, 2));
      } else {
        this.log(formatBuildFailure(message));
      }

      this.exit(1);
    }
  }
}
