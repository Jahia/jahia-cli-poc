import { Command, Flags } from '@oclif/core';

import { DEFAULT_PROVIDER } from '../../lib/config/defaults.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { deleteState } from '../../lib/state/delete-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { getProvider } from '../../lib/providers/index.js';

export default class EnvironmentDelete extends Command {
  static override description =
    'Destroy a Jahia environment completely. ' +
    'Removes all containers, networks, and volumes associated with the environment.';

  static override examples = [
    '<%= config.bin %> environment delete',
    '<%= config.bin %> environment delete --json',
    '<%= config.bin %> environment delete --state /ci/workspace/state.json',
  ];

  static override flags = {
    state: stateFlag,
    provider: Flags.string({
      char: 'p',
      description: 'Provider to use',
      default: DEFAULT_PROVIDER,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentDelete);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    if (!env) {
      const msg = 'No active environment found. Nothing to delete.';
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'no_environment', message: msg, stateFile: statePath }));
      } else {
        this.error(msg);
      }
      return;
    }

    const provider = getProvider(flags.provider);
    const result = await provider.destroyEnvironment(env.name, env.composePath);

    await deleteState(stateOverride);

    if (flags.json) {
      this.log(JSON.stringify({ ...result, stateFile: statePath }, null, 2));
    } else {
      if (result.success) {
        this.log(`✓ Environment "${env.name}" deleted successfully`);
        this.log(`  Removed ${String(result.removedComponents.length)} container(s)`);
        this.log(`  Removed ${String(result.removedVolumes.length)} volume(s)`);
      } else {
        this.log(`✗ Environment "${env.name}" deletion encountered errors`);
        result.errors.forEach((err) => {
          this.log(`  • ${err}`);
        });
      }
      this.log(`  State: ${statePath}`);
    }

    if (!result.success) {
      this.exit(1);
    }
  }
}
