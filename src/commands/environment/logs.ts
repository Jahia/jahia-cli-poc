import { Command, Flags } from '@oclif/core';

import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { containerName } from '../../lib/providers/docker/container.js';
import { getContainerLogs } from '../../lib/providers/docker/get-container-logs.js';

export default class EnvironmentLogs extends Command {
  static override description =
    'View logs from a component in the active Jahia environment. ' +
    'Shows the most recent log output from the specified container.';

  static override examples = [
    '<%= config.bin %> environment logs --component jahia',
    '<%= config.bin %> environment logs --component jahia --tail 50',
    '<%= config.bin %> environment logs --component jahia --json',
    '<%= config.bin %> environment logs --component jahia --state /ci/workspace/state.json',
  ];

  static override flags = {
    state: stateFlag,
    component: Flags.string({
      char: 'C',
      description: 'Component to show logs for (required)',
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
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentLogs);
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

    const component = env.components.find((c) => c.name === flags.component);
    if (!component) {
      const available = env.components.map((c) => c.name).join(', ');
      const msg = `Component "${flags.component}" not found. Available: ${available}`;
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'component_not_found', message: msg, stateFile: statePath }));
      } else {
        this.error(msg);
      }
      return;
    }

    const name = containerName(env.name, component.name);
    const logs = await getContainerLogs(name, flags.tail);

    if (flags.json) {
      this.log(
        JSON.stringify({
          success: true,
          component: component.name,
          environment: env.name,
          stateFile: statePath,
          lines: logs.split('\n').filter(Boolean),
        }),
      );
    } else {
      this.log(`── Logs for ${component.name} (${name}) ──`);
      this.log(logs);
    }
  }
}
