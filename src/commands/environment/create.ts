import { writeFile } from 'node:fs/promises';

import { Command, Flags } from '@oclif/core';
import { confirm, input } from '@inquirer/prompts';

import { getComponent, listUserSelectableComponents } from '../../lib/components/index.js';
import { generateEnvName } from '../../lib/config/defaults.js';
import { configToYaml } from '../../lib/config/config-to-yaml.js';
import { extractExportableConfig, mergeEnvironmentIntoConfig } from '../../lib/config/export-config.js';
import { loadConfigFile, resolveConfigComponents } from '../../lib/config/parser.js';
import type { ConfigComponent, EnvironmentConfig } from '../../lib/config/types.js';
import { formatCreateResultHuman, formatCreateResultJson } from '../../lib/output/formatter.js';
import { getProvider } from '../../lib/providers/index.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { deleteState } from '../../lib/state/delete-state.js';
import { saveState } from '../../lib/state/save-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import type { PersistedEnvironment, StateFile } from '../../lib/state/types.js';
import { jahia as jahiaComponent } from '../../lib/components/jahia.js';
import { loadExistingConfig } from './export.js';

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
 * Prompts the user for optional utility components (e.g., SMTP server).
 * Returns an array of ConfigComponent entries to add to the environment.
 */
export const promptForOptionalComponents = async (): Promise<readonly ConfigComponent[]> => {
  const components: ConfigComponent[] = [];

  const wantSmtp = await confirm({
    message: 'Add an SMTP server (Mailpit) for email testing?',
    default: false,
  });
  if (wantSmtp) {
    components.push({ name: 'smtp-server' });
  }

  return components;
};

export default class EnvironmentCreate extends Command {
  static override description =
    'Create a new Jahia environment. ' +
    'Starts Jahia with embedded Derby database and VictoriaLogs for log aggregation. ' +
    'Use interactive mode (no arguments) or provide a YAML config file.';

  static override examples = [
    '<%= config.bin %> environment create',
    '<%= config.bin %> environment create --config ./environment.yml',
    '<%= config.bin %> environment create --force',
    '<%= config.bin %> environment create --export-config ./env.yml',
    '<%= config.bin %> environment create --config ./environment.yml --export-config ./env.yml',
    '<%= config.bin %> environment create --state /ci/workspace/state.json',
  ];

  static override flags = {
    state: stateFlag,
    config: Flags.string({
      char: 'c',
      description: 'Path to a YAML environment configuration file',
      env: 'JAHIA_CLI_CONFIG',
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
        const envConfig = extractExportableConfig(persistedEnv);
        const existingConfig = await loadExistingConfig(exportPath);
        const mergedConfig = mergeEnvironmentIntoConfig(existingConfig, envConfig);
        const yamlContent = configToYaml(mergedConfig);
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
  }): Promise<EnvironmentConfig> {
    if (flags.config) {
      const loaded = await loadConfigFile(flags.config);
      if (!loaded.environment) {
        this.error('Configuration file must include an "environment" section with at least one component.');
      }
      return loaded.environment;
    }

    // Interactive mode — ask for Jahia version, then optional components
    const { version } = await promptForJahiaConfig();
    const optionalComponents = await promptForOptionalComponents();
    return {
      name: generateEnvName(),
      provider: 'docker',
      components: [
        { name: 'jahia', overrides: version !== jahiaComponent.defaultTag ? { tag: version } : undefined },
        ...optionalComponents,
      ],
    };
  }
}
