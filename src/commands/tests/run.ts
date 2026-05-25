import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { Command, Flags } from '@oclif/core';

import { loadConfigFile } from '../../lib/config/parser.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

/**
 * Formats a human-readable profile run start message.
 */
export const formatProfileRunStart = (
  profile: string,
  composePath: string,
): string =>
  [
    `▶ Running tests`,
    `  Profile:      ${profile}`,
    `  Compose file: ${composePath}`,
    '',
  ].join('\n');

/**
 * Formats a human-readable profile run completion message.
 */
export const formatProfileRunComplete = (
  profile: string,
  exitCode: number,
): string => {
  const icon = exitCode === 0 ? '✓' : '✗';
  const status = exitCode === 0 ? 'passed' : `failed (exit code ${String(exitCode)})`;
  return `${icon} Tests ${status} (profile: ${profile})`;
};

/**
 * Runs docker compose up for a given profile and streams output.
 * Returns the exit code of the docker compose process.
 */
export const runComposeProfile = (
  composePath: string,
  profile: string,
): Promise<number> =>
  new Promise((resolvePromise) => {
    const child = spawn(
      'docker',
      ['compose', '-f', composePath, '--profile', profile, 'up', '--abort-on-container-exit'],
      { stdio: 'inherit' },
    );

    child.on('close', (code) => {
      resolvePromise(code ?? 1);
    });

    child.on('error', () => {
      resolvePromise(1);
    });
  });

export default class TestsRun extends Command {
  static override description =
    'Start all containers in a docker compose profile and stream logs until they stop. ' +
    'Exits with the container exit code. The profile defaults to "tests" but can be customized.';

  static override examples = [
    '<%= config.bin %> tests run -c config.yml',
    '<%= config.bin %> tests run -c config.yml --profile integration',
    '<%= config.bin %> tests run -c config.yml --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to jahia-cli config file',
      required: true,
    }),
    state: stateFlag,
    profile: Flags.string({
      char: 'p',
      description: 'Docker compose profile to start (default: tests)',
      default: 'tests',
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(TestsRun);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
    const statePath = stateFilePath(flags.state);

    try {
      const activeEnv = await getActiveEnvironment(statePath);
      if (activeEnv === undefined) {
        throw new Error('No active environment found. Create one with "environment create" first.');
      }

      // Validate config is parseable
      await loadConfigFile(resolve(flags.config));

      const composePath = activeEnv.composePath;

      if (!flags.json) {
        this.log(formatProfileRunStart(flags.profile, composePath));
      }

      const exitCode = await runComposeProfile(composePath, flags.profile);

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              success: exitCode === 0,
              exitCode,
              profile: flags.profile,
              composePath,
            },
            null,
            2,
          ),
        );
      } else {
        this.log(formatProfileRunComplete(flags.profile, exitCode));
      }

      if (exitCode !== 0) {
        this.exit(exitCode);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: message }, null, 2));
      } else {
        this.error(message);
      }
    }
  }
}
