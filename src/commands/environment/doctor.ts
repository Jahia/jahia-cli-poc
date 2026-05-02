import { Command, Flags } from '@oclif/core';

import { DEFAULT_PROVIDER } from '../../lib/config/defaults.js';
import { formatHealthCheckHuman, formatHealthCheckJson } from '../../lib/output/formatter.js';
import { getProvider, listProviderNames } from '../../lib/providers/index.js';

export default class EnvironmentDoctor extends Command {
  static override description =
    'Check the health status of a Jahia environment. ' +
    'Reports whether containers are running and passing healthchecks.';

  static override examples = [
    '<%= config.bin %> environment doctor --name my-env',
    '<%= config.bin %> environment doctor --name my-env --json',
  ];

  static override flags = {
    name: Flags.string({
      char: 'n',
      description: 'Name of the environment to check',
      required: true,
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

    const provider = getProvider(flags.provider);
    const result = await provider.checkHealth(flags.name);

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
