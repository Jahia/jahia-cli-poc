import { Command, Flags } from '@oclif/core';

import { DEFAULT_PROVIDER } from '../../lib/config/defaults.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { loadState } from '../../lib/state/load-state.js';
import { saveState } from '../../lib/state/save-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { getProvider } from '../../lib/providers/index.js';

export default class EnvironmentStop extends Command {
  static override description =
    'Stop a running Jahia environment without destroying it. ' +
    'Containers are stopped but preserved for later restart.';

  static override examples = [
    '<%= config.bin %> environment stop',
    '<%= config.bin %> environment stop --json',
    '<%= config.bin %> environment stop --state /ci/workspace/state.json',
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
    const { flags } = await this.parse(EnvironmentStop);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    if (!env) {
      const msg = 'No active environment found. Nothing to stop.';
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'no_environment', message: msg, stateFile: statePath }));
      } else {
        this.error(msg);
      }
      return;
    }

    const provider = getProvider(flags.provider);
    const result = await provider.stopEnvironment(env.name, env.composePath);

    const state = await loadState(stateOverride);
    if (state?.environment) {
      await saveState(
        { ...state, environment: { ...state.environment, stoppedAt: new Date().toISOString() } },
        stateOverride,
      );
    }

    if (flags.json) {
      this.log(JSON.stringify({ ...result, stateFile: statePath }, null, 2));
    } else {
      if (result.success) {
        this.log(`✓ Environment "${env.name}" stopped successfully`);
        this.log(`  Stopped ${String(result.stoppedComponents.length)} container(s)`);
      } else {
        this.log(`✗ Environment "${env.name}" stop encountered errors`);
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
