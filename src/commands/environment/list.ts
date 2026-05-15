import { Command, Flags } from '@oclif/core';

import { formatEnvironmentListHuman } from '../../lib/output/formatter.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { reconcileWithDocker } from '../../lib/state/reconcile-with-docker.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';

export default class EnvironmentList extends Command {
  static override description =
    'List all components in the active Jahia environment with their live status. ' +
    'Reconciles persisted state with actual Docker container status.';

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
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentList);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    if (!env) {
      const msg = 'No active environment found. Use "environment create" first.';
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'no_environment', message: msg, stateFile: statePath }));
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
          network: reconciled.network,
          createdAt: reconciled.createdAt,
          stoppedAt: reconciled.stoppedAt,
          stateFile: statePath,
          components: reconciled.components.map((c) => ({
            name: c.name,
            image: c.image,
            tag: c.tag,
            containerId: c.containerId,
            status: c.liveStatus,
            endpoints: c.endpoints,
          })),
        }),
      );
    } else {
      const status = reconciled.stoppedAt ? 'stopped' : 'running';
      this.log(formatEnvironmentListHuman({
        name: reconciled.name,
        provider: reconciled.provider,
        network: reconciled.network,
        createdAt: reconciled.createdAt,
        status,
        components: reconciled.components,
      }));
      this.log(`  State:   ${statePath}`);
    }
  }
}
