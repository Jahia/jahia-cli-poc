import { Command, Flags } from '@oclif/core';

import { loadConfigFile } from '../../lib/config/parser.js';
import type { EnvironmentConfig } from '../../lib/config/types.js';
import { getProvider } from '../../lib/providers/index.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { deleteState } from '../../lib/state/delete-state.js';
import { saveState } from '../../lib/state/save-state.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import type { PersistedEnvironment, StateFile } from '../../lib/state/types.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

export default class EnvironmentCreate extends Command {
  static override description =
    'Create a new Jahia environment using docker compose. ' +
    'Starts all services defined in the docker-compose.yml generated during init. ' +
    'Use interactive init first to generate the compose file, or provide a config.';

  static override examples = [
    '<%= config.bin %> environment create',
    '<%= config.bin %> environment create --config ./jahia-cli.config.yml',
    '<%= config.bin %> environment create --force',
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
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(EnvironmentCreate);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    // Single-environment guard
    const existing = await getActiveEnvironment(stateOverride);
    if (existing) {
      if (flags.force) {
        const provider = getProvider(existing.provider);
        await provider.destroyEnvironment(existing.name, existing.composePath);
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

    if (!config.composePath) {
      const msg =
        'No composePath found in configuration. Run "jahia-cli init" first to generate a docker-compose.yml.';
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: 'no_compose_path', message: msg }));
      } else {
        this.error(msg);
      }
      return;
    }

    const provider = getProvider(config.provider);
    const result = await provider.createEnvironment(
      config.name,
      config.composePath,
      (msg: string) => {
        if (!flags.json) {
          this.log(msg);
        }
      },
    );

    // Persist state on success
    if (result.success) {
      const persistedEnv: PersistedEnvironment = {
        name: config.name,
        provider: config.provider,
        composePath: config.composePath,
        config,
        createdAt: result.environment.createdAt ?? new Date().toISOString(),
      };
      const stateFile: StateFile = { version: 1, environment: persistedEnv };
      await saveState(stateFile, stateOverride);
    }

    // Output
    if (flags.json) {
      this.log(JSON.stringify({ ...result, stateFile: statePath }, null, 2));
    } else {
      if (result.success) {
        this.log(`✓ Environment "${config.name}" created successfully`);
        this.log(`  Services: ${String(result.environment.components.length)} running`);
        this.log(`  Compose:  ${config.composePath}`);
      } else {
        this.log(`✗ Environment creation failed`);
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

  private async resolveConfig(flags: { config: string | undefined }): Promise<EnvironmentConfig> {
    if (flags.config) {
      const loaded = await loadConfigFile(flags.config);
      if (!loaded.environment) {
        this.error('Configuration file must include an "environment" section.');
      }
      return loaded.environment;
    }

    // Try default config file
    const loaded = await loadConfigFile('jahia-cli.config.yml').catch(() => undefined);
    if (loaded?.environment) {
      return loaded.environment;
    }

    this.error('No configuration found. Run "jahia-cli init" first, or provide --config.');
  }
}
