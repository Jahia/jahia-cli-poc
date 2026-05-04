import { Command, Flags } from '@oclif/core';

import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { reconcileWithDocker } from '../../lib/state/reconcile-with-docker.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateDirFlag } from '../../lib/state/state-dir-flag.js';

export default class EnvironmentList extends Command {
  static override description =
    'List all components in the active Jahia environment with their live status. ' +
    'Reconciles persisted state with actual Docker container status.';

  static override examples = [
    '<%= config.bin %> environment list',
    '<%= config.bin %> environment list --json',
    '<%= config.bin %> environment list --state-dir /ci/workspace',
  ];

  static override flags = {
    'state-dir': stateDirFlag,
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentList);
    const stateDir = flags['state-dir'];
    const statePath = stateFilePath(stateDir);

    const env = await getActiveEnvironment(stateDir);
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
          })),
        }),
      );
    } else {
      const status = reconciled.stoppedAt ? 'stopped' : 'running';
      this.log(`Environment: ${reconciled.name} (${status})`);
      this.log(`Provider: ${reconciled.provider}`);
      this.log(`Network: ${reconciled.network}`);
      this.log(`Created: ${reconciled.createdAt}`);
      this.log(`State:   ${statePath}`);
      this.log('');
      this.log('  Component          Image                    Tag         Status      Container ID');
      this.log('  ─────────────────────────────────────────────────────────────────────────────────');

      reconciled.components.forEach((c) => {
        const name = c.name.padEnd(18);
        const image = c.image.padEnd(24);
        const tag = c.tag.padEnd(11);
        const liveStatus = c.liveStatus.padEnd(11);
        const id = c.containerId.slice(0, 12);
        this.log(`  ${name} ${image} ${tag} ${liveStatus} ${id}`);
      });
    }
  }
}
