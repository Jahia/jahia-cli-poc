import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Command, Flags } from '@oclif/core';

import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

const execFileAsync = promisify(execFile);

/**
 * Fetches logs from a docker compose service.
 */
const getServiceLogs = async (
  composePath: string,
  service: string,
  tail: number,
): Promise<string> => {
  const { stdout } = await execFileAsync('docker', [
    'compose',
    '-f',
    composePath,
    'logs',
    '--tail',
    String(tail),
    service,
  ]);
  return stdout;
};

export default class EnvironmentLogs extends Command {
  static override description =
    'View logs from a service in the active Jahia environment. ' +
    'Shows the most recent log output from the specified service.';

  static override examples = [
    '<%= config.bin %> environment logs --service jahia',
    '<%= config.bin %> environment logs --service jahia --tail 50',
    '<%= config.bin %> environment logs --service jahia --json',
    '<%= config.bin %> environment logs --service jahia --state /ci/workspace/state.json',
  ];

  static override flags = {
    state: stateFlag,
    service: Flags.string({
      char: 's',
      description: 'Service to show logs for (required)',
      required: true,
    }),
    tail: Flags.integer({
      char: 't',
      description: 'Number of lines to show from the end',
      default: 100,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentLogs);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    if (!env) {
      const msg = 'No active environment found. Use "environment create" first.';
      if (flags.json) {
        this.log(
          JSON.stringify({
            success: false,
            error: 'no_environment',
            message: msg,
            stateFile: statePath,
          }),
        );
      } else {
        this.error(msg);
      }
      return;
    }

    const logs = await getServiceLogs(env.composePath, flags.service, flags.tail);

    if (flags.json) {
      this.log(
        JSON.stringify({
          success: true,
          service: flags.service,
          environment: env.name,
          stateFile: statePath,
          lines: logs.split('\n').filter(Boolean),
        }),
      );
    } else {
      this.log(`── Logs for ${flags.service} ──`);
      this.log(logs);
    }
  }
}
