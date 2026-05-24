import { Command, Flags } from '@oclif/core';

import { formatEnvironmentListHuman } from '../../lib/output/formatter.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { reconcileWithDocker } from '../../lib/state/reconcile-with-docker.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

export default class EnvironmentList extends Command {
  static override description =
    'List all services in the active Jahia environment with their live status. ' +
    'Reconciles persisted state with actual Docker Compose service status.';

  static override examples = [
    '<%= config.bin %> environment list',
    '<%= config.bin %> environment list --json',
    '<%= config.bin %> environment list --state /ci/workspace/state.json',
  ];

  static override flags = {
    state: stateFlag,
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentList);
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

    const reconciled = await reconcileWithDocker(env);

    if (flags.json) {
      this.log(
        JSON.stringify({
          success: true,
          environment: reconciled.name,
          provider: reconciled.provider,
          composePath: reconciled.composePath,
          stateFile: statePath,
          services: reconciled.services,
        }),
      );
    } else {
      const status = env.stoppedAt ? 'stopped' : 'running';
      this.log(
        formatEnvironmentListHuman({
          name: reconciled.name,
          provider: reconciled.provider,
          composePath: reconciled.composePath,
          createdAt: env.createdAt,
          status,
          services: reconciled.services,
        }),
      );
      this.log(`  State:   ${statePath}`);
    }
  }
}
