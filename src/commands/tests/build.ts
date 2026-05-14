import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { execa } from 'execa';

import { loadConfigFile } from '../../lib/config/parser.js';
import type { TestContainerConfig } from '../../lib/config/types.js';
import {
  DEFAULT_DOCKERFILE,
  DEFAULT_IMAGE_NAME,
  buildBuildxArgs,
  resolveImageTag,
} from '../../lib/tests/build-image.js';

/**
 * Resolves the effective image tag from config.
 * Priority: tests.container.tag > tests.scaffolding.version > 'latest'
 */
export const resolveVersion = (
  containerConfig: TestContainerConfig | undefined,
  scaffoldingVersion: string | undefined,
): string => containerConfig?.tag ?? scaffoldingVersion ?? 'latest';

/**
 * Resolves the effective image name from config.
 */
export const resolveImageName = (
  containerConfig: TestContainerConfig | undefined,
): string => containerConfig?.image ?? DEFAULT_IMAGE_NAME;

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
    'Build the test Docker image using docker buildx. ' +
    'All build parameters (dockerfile, image, tag, platform, buildArgs) are read from ' +
    'the config file under tests.container. The image stays local (no push) ' +
    'and can be run with "tests run".';

  static override examples = [
    '<%= config.bin %> tests build -c config.yml',
    '<%= config.bin %> tests build -c config.yml --no-cache',
    '<%= config.bin %> tests build -c config.yml --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to jahia-cli config file',
      required: true,
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
      const containerConfig = config.tests?.container;
      const version = resolveVersion(containerConfig, config.tests?.scaffolding?.version);
      const imageName = resolveImageName(containerConfig);
      const dockerfile = containerConfig?.dockerfile ?? DEFAULT_DOCKERFILE;
      const tag = resolveImageTag(imageName, version);

      const args = buildBuildxArgs({
        dockerfile,
        tag,
        baseVersion: version,
        platform: containerConfig?.platform,
        noCache: flags['no-cache'],
        extraBuildArgs: containerConfig?.buildArgs,
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
