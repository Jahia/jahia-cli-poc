import { writeFile } from 'node:fs/promises';

import { Command, Flags } from '@oclif/core';
import { input } from '@inquirer/prompts';

import { getComponent, listUserSelectableComponents } from '../../lib/components/index.js';
import { DEFAULT_PROVIDER, generateEnvName } from '../../lib/config/defaults.js';
import { configToYaml } from '../../lib/config/config-to-yaml.js';
import { extractExportableConfig } from '../../lib/config/export-config.js';
import { loadConfigFile, resolveConfigComponents } from '../../lib/config/parser.js';
import type { EnvironmentConfig } from '../../lib/config/types.js';
import { formatCreateResultHuman, formatCreateResultJson } from '../../lib/output/formatter.js';
import { getProvider, listProviderNames } from '../../lib/providers/index.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { deleteState } from '../../lib/state/delete-state.js';
import { saveState } from '../../lib/state/save-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import type { PersistedEnvironment, StateFile } from '../../lib/state/types.js';
import { jahia as jahiaComponent } from '../../lib/components/jahia.js';

/**
 * Prompts the user interactively for Jahia version and builds a minimal config.
 */
export const promptForJahiaConfig = async (): Promise<{
  readonly version: string;
}> => {
  const version = await input({
    message: 'Jahia version:',
    default: jahiaComponent.defaultTag,
  });
  return { version };
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
    'Create a new Jahia environment. ' +
    'Starts Jahia with embedded Derby database and VictoriaLogs for log aggregation. ' +
    'Supports interactive setup, inline flags, or a YAML config file.';

  static override examples = [
    '<%= config.bin %> environment create',
    '<%= config.bin %> environment create --component jahia',
    '<%= config.bin %> environment create --config ./environment.yml',
    '<%= config.bin %> environment create --name my-env --component jahia --json',
    '<%= config.bin %> environment create --component jahia --force',
    '<%= config.bin %> environment create --component jahia --state /ci/workspace/state.json',
    '<%= config.bin %> environment create --export-config ./env.yml',
  ];

  static override flags = {
    state: stateFlag,
    config: Flags.string({
      char: 'c',
      description: 'Path to a YAML environment configuration file',
    }),
    component: Flags.string({
      char: 'C',
      description:
        'Component to include (repeatable). Available: ' +
        listUserSelectableComponents().map((c) => c.name).join(', '),
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
    'export-config': Flags.string({
      char: 'e',
      description: 'Export the environment configuration to a YAML file after creation',
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentCreate);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    // Single-environment guard
    const existing = await getActiveEnvironment(stateOverride);
    if (existing) {
      if (flags.force) {
        const provider = getProvider(existing.provider);
        await provider.destroyEnvironment(existing.name);
        await deleteState(stateOverride);
      } else {
        const msg =
          `An environment "${existing.name}" is already active.\n\n` +
          `  State file: ${statePath}\n\n` +
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
          `Unknown component "${entry.name}". Available: ${listUserSelectableComponents()
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
      const persistedEnv: PersistedEnvironment = {
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
      };
      const stateFile: StateFile = { version: 1, environment: persistedEnv };
      await saveState(stateFile, stateOverride);

      // Export config if requested
      const exportPath = flags['export-config'];
      if (exportPath) {
        const exportableConfig = extractExportableConfig(persistedEnv);
        const yamlContent = configToYaml(exportableConfig);
        await writeFile(exportPath, yamlContent, 'utf-8');
      }
    }

    // Output
    if (flags.json) {
      this.log(formatCreateResultJson(result, statePath));
    } else {
      this.log(formatCreateResultHuman(result));
      this.log(`  State: ${statePath}`);
      const exportPath = flags['export-config'];
      if (result.success && exportPath) {
        this.log(`  Config exported: ${exportPath}`);
      }
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
      const loaded = await loadConfigFile(flags.config);
      if (!loaded.environment) {
        this.error('Configuration file must include an "environment" section with at least one component.');
      }
      return loaded.environment;
    }

    if (flags.component && flags.component.length > 0) {
      return buildConfigFromFlags({
        name: flags.name,
        provider: flags.provider,
        components: flags.component,
      });
    }

    // Interactive mode — ask for Jahia version only
    const { version } = await promptForJahiaConfig();
    return {
      name: flags.name ?? generateEnvName(),
      provider: flags.provider,
      components: [{ name: 'jahia', overrides: version !== jahiaComponent.defaultTag ? { tag: version } : undefined }],
    };
  }
}
