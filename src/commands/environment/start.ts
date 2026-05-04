import { Command, Flags } from '@oclif/core';

import { DEFAULT_PROVIDER } from '../../lib/config/defaults.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { loadState } from '../../lib/state/load-state.js';
import { saveState } from '../../lib/state/save-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateDirFlag } from '../../lib/state/state-dir-flag.js';
import { getProvider } from '../../lib/providers/index.js';

export default class EnvironmentStart extends Command {
  static override description =
    'Start a previously stopped Jahia environment. ' +
    'Resumes all containers that were stopped with "environment stop".';

  static override examples = [
    '<%= config.bin %> environment start',
    '<%= config.bin %> environment start --json',
    '<%= config.bin %> environment start --state-dir /ci/workspace',
  ];

  static override flags = {
    'state-dir': stateDirFlag,
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
    const { flags } = await this.parse(EnvironmentStart);
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

    const provider = getProvider(flags.provider);
    const result = await provider.startEnvironment(env.name);

    const state = await loadState(stateDir);
    if (state?.environment) {
      await saveState(
        { ...state, environment: { ...state.environment, stoppedAt: undefined } },
        stateDir,
      );
    }

    if (flags.json) {
      this.log(JSON.stringify({ ...result, stateFile: statePath }, null, 2));
    } else {
      if (result.success) {
        this.log(`✓ Environment "${env.name}" started successfully`);
        this.log(`  Started ${String(result.startedComponents.length)} container(s)`);
      } else {
        this.log(`✗ Environment "${env.name}" start encountered errors`);
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
