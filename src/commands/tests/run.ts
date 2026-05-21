import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { execa } from 'execa';

import { loadConfigFile } from '../../lib/config/parser.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { parseKeyValueArgs } from '../../lib/tests/build-image.js';
import { formatRunComplete, formatRunStart } from '../../lib/tests/format-run-output.js';

// Re-export extracted functions for backward-compatible test imports
export { formatRunComplete, formatRunStart } from '../../lib/tests/format-run-output.js';

export default class TestsRun extends Command {
  static override description =
    'Run the test service from the docker-compose environment. ' +
    'Uses docker compose run to execute the test container, streams output in real-time, ' +
    'and the CLI exits with the container exit code.';

  static override examples = [
    '<%= config.bin %> tests run -c config.yml',
    '<%= config.bin %> tests run -c config.yml --env CYPRESS_SPEC=cypress/e2e/login.cy.ts',
    '<%= config.bin %> tests run -c config.yml --state /ci/workspace/state.json --json',
    '<%= config.bin %> tests run -c config.yml --service cypress',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to jahia-cli config file',
      required: true,
    }),
    state: stateFlag,
    service: Flags.string({
      char: 's',
      description: 'Name of the test service in docker-compose (default: cypress)',
      default: 'cypress',
    }),
    env: Flags.string({
      char: 'e',
      description: 'Additional env var for test container (KEY=VALUE, repeatable). Supports ${VAR:-default}.',
      multiple: true,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(TestsRun);
    const statePath = stateFilePath(flags.state);

    try {
      const activeEnv = await getActiveEnvironment(statePath);
      if (activeEnv === undefined) {
        throw new Error('No active environment found. Create one with "environment create" first.');
      }

      // Load config to validate it exists and is parseable
      await loadConfigFile(resolve(flags.config));

      const userEnv = flags.env !== undefined
        ? parseKeyValueArgs(flags.env)
        : {};

      const envArgs = Object.entries(userEnv).flatMap(([key, value]) => ['-e', `${key}=${value}`]);

      if (!flags.json) {
        this.log(formatRunStart(flags.service, activeEnv.composePath, flags.service, undefined));
      }

      const result = await execa('docker', [
        'compose',
        '-f',
        activeEnv.composePath,
        'run',
        '--rm',
        ...envArgs,
        flags.service,
      ], {
        stdio: 'inherit',
        reject: false,
      });

      const exitCode = result.exitCode ?? 1;

      if (flags.json) {
        this.log(JSON.stringify({
          success: exitCode === 0,
          exitCode,
          service: flags.service,
          composePath: activeEnv.composePath,
        }, null, 2));
      } else {
        this.log(formatRunComplete(flags.service, exitCode));
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
