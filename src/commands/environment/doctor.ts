import { Command, Flags } from '@oclif/core';

import { DEFAULT_PROVIDER } from '../../lib/config/defaults.js';
import { formatHealthCheckHuman, formatHealthCheckJson } from '../../lib/output/formatter.js';
import { getProvider, listProviderNames } from '../../lib/providers/index.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';

export default class EnvironmentDoctor extends Command {
  static override description =
    'Check the health status of a Jahia environment. ' +
    'Reports whether containers are running and passing healthchecks. ' +
    'Uses the active environment if --name is not specified.';

  static override examples = [
    '<%= config.bin %> environment doctor',
    '<%= config.bin %> environment doctor --name my-env',
    '<%= config.bin %> environment doctor --json',
  ];

  static override flags = {
    name: Flags.string({
      char: 'n',
      description: 'Name of the environment to check (uses active environment if omitted)',
    }),
    provider: Flags.string({
      char: 'p',
      description: `Provider to use (available: ${listProviderNames().join(', ')})`,
      default: DEFAULT_PROVIDER,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentDoctor);

    // Resolve environment name from flag or active state
    const envName = flags.name ?? (await getActiveEnvironment())?.name;
    if (!envName) {
      const msg = 'No environment specified and no active environment found. Use --name or create an environment first.';
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'no_environment', message: msg }));
      } else {
        this.error(msg);
      }
      return;
    }

    const provider = getProvider(flags.provider);
    const result = await provider.checkHealth(envName);

    if (flags.json) {
      this.log(formatHealthCheckJson(result));
    } else {
      this.log(formatHealthCheckHuman(result));
    }

    if (!result.success) {
      this.exit(1);
    }
  }
}
