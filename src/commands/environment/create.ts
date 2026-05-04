import { Command, Flags } from '@oclif/core';
import { checkbox } from '@inquirer/prompts';

import { getComponent, listComponents } from '../../lib/components/index.js';
import { DEFAULT_PROVIDER, generateEnvName } from '../../lib/config/defaults.js';
import { loadConfigFile, resolveConfigComponents } from '../../lib/config/parser.js';
import type { EnvironmentConfig } from '../../lib/config/types.js';
import { formatCreateResultHuman, formatCreateResultJson } from '../../lib/output/formatter.js';
import { getProvider, listProviderNames } from '../../lib/providers/index.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { deleteState } from '../../lib/state/delete-state.js';
import { saveState } from '../../lib/state/save-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateDirFlag } from '../../lib/state/state-dir-flag.js';
import type { StateFile } from '../../lib/state/types.js';

/**
 * Prompts the user interactively to select components from the library.
 */
export const promptForComponents = async (): Promise<readonly string[]> => {
  const components = listComponents();
  const selected = await checkbox({
    message: 'Select components to include in your environment:',
    choices: components.map((c) => ({
      name: `${c.name} — ${c.description}`,
      value: c.name,
    })),
  });
  return selected;
};

/**
 * Builds an EnvironmentConfig from command flags.
 */
export const buildConfigFromFlags = (params: {
  readonly name: string | undefined;
  readonly provider: string;
  readonly components: readonly string[];
}): EnvironmentConfig => ({
  name: params.name ?? generateEnvName(),
  provider: params.provider,
  components: params.components.map((name) => ({ name })),
});

export default class EnvironmentCreate extends Command {
  static override description =
    'Create a new Jahia environment from predefined components. ' +
    'Supports interactive selection, inline flags, or a YAML config file.';

  static override examples = [
    '<%= config.bin %> environment create',
    '<%= config.bin %> environment create --component jahia --component pgsql',
    '<%= config.bin %> environment create --config ./environment.yml',
    '<%= config.bin %> environment create --name my-env --component jahia --component pgsql --json',
    '<%= config.bin %> environment create --component jahia --force',
    '<%= config.bin %> environment create --component jahia --state-dir /ci/workspace',
  ];

  static override flags = {
    'state-dir': stateDirFlag,
    config: Flags.string({
      char: 'c',
      description: 'Path to a YAML environment configuration file',
    }),
    component: Flags.string({
      char: 'C',
      description:
        'Component to include (repeatable). Available: jahia, pgsql, elasticsearch, jahia-browsing',
      multiple: true,
    }),
    name: Flags.string({
      char: 'n',
      description: 'Name for the environment (auto-generated if not specified)',
    }),
    provider: Flags.string({
      char: 'p',
      description: `Provider to use (available: ${listProviderNames().join(', ')})`,
      default: DEFAULT_PROVIDER,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Delete existing environment before creating a new one',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentCreate);
    const stateDir = flags['state-dir'];
    const statePath = stateFilePath(stateDir);

    // Single-environment guard
    const existing = await getActiveEnvironment(stateDir);
    if (existing) {
      if (flags.force) {
        const provider = getProvider(existing.provider);
        await provider.destroyEnvironment(existing.name);
        await deleteState(stateDir);
      } else {
        const msg =
          `An environment "${existing.name}" is already active.\n\n` +
          '  To stop it:   jahia-cli environment stop\n' +
          '  To delete it: jahia-cli environment delete\n\n' +
          '  Use --force to override this check.';
        if (flags.json) {
          this.log(
            JSON.stringify({
              success: false,
              error: 'environment_exists',
              existing: existing.name,
              message: msg,
              stateFile: statePath,
            }),
          );
        } else {
          this.error(msg);
        }
        return;
      }
    }

    const config: EnvironmentConfig = await this.resolveConfig(flags);

    // Validate all component names exist
    config.components.forEach((entry) => {
      const def = getComponent(entry.name);
      if (!def) {
        this.error(
          `Unknown component "${entry.name}". Available: ${listComponents()
            .map((c) => c.name)
            .join(', ')}`,
        );
      }
    });

    // Resolve components and create environment
    const resolved = resolveConfigComponents(config);
    const provider = getProvider(config.provider);
    const result = await provider.createEnvironment(config.name, resolved);

    // Persist state on success
    if (result.success) {
      const stateFile: StateFile = {
        version: 1,
        environment: {
          name: config.name,
          provider: config.provider,
          network: result.environment.network,
          components: result.environment.components.map((c) => ({
            name: c.name,
            image:
              resolved.find((r) => r.definition.name === c.name)?.definition.image ?? 'unknown',
            tag: resolved.find((r) => r.definition.name === c.name)?.effectiveTag ?? 'latest',
            containerId: c.containerId ?? '',
          })),
          config,
          createdAt: result.environment.createdAt ?? new Date().toISOString(),
        },
      };
      await saveState(stateFile, stateDir);
    }

    // Output
    if (flags.json) {
      this.log(formatCreateResultJson(result, statePath));
    } else {
      this.log(formatCreateResultHuman(result));
      this.log(`  State: ${statePath}`);
    }

    if (!result.success) {
      this.exit(1);
    }
  }

  private async resolveConfig(flags: {
    config: string | undefined;
    component: string[] | undefined;
    name: string | undefined;
    provider: string;
  }): Promise<EnvironmentConfig> {
    if (flags.config) {
      return loadConfigFile(flags.config);
    }

    if (flags.component && flags.component.length > 0) {
      return buildConfigFromFlags({
        name: flags.name,
        provider: flags.provider,
        components: flags.component,
      });
    }

    // Interactive mode
    const selected = await promptForComponents();
    if (selected.length === 0) {
      this.error('No components selected. Aborting.');
    }
    return buildConfigFromFlags({
      name: flags.name,
      provider: flags.provider,
      components: selected,
    });
  }
}
