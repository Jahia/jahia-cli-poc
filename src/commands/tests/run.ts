import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { execa, type ExecaError } from 'execa';

import { applyEnvInjections, getComponent, resolveComponent } from '../../lib/components/index.js';
import type { ResolvedComponent } from '../../lib/components/types.js';
import { loadConfigFile } from '../../lib/config/parser.js';
import type { TestContainerConfig } from '../../lib/config/types.js';
import { buildRunArgs, containerName, removeContainer, stopContainer } from '../../lib/providers/docker/container.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { DEFAULT_IMAGE_NAME, parseKeyValueArgs } from '../../lib/tests/build-image.js';

/**
 * Formats a human-readable test run start message.
 */
export const formatRunStart = (image: string, network: string, name: string): string =>
  [
    `▶ Running tests`,
    `  Image:     ${image}`,
    `  Network:   ${network}`,
    `  Container: ${name}`,
    '',
  ].join('\n');

/**
 * Formats a human-readable test completion message.
 */
export const formatRunComplete = (
  name: string,
  exitCode: number,
): string => {
  const icon = exitCode === 0 ? '✓' : '✗';
  const status = exitCode === 0 ? 'passed' : `failed (exit code ${String(exitCode)})`;
  return `${icon} Tests ${status}\n  Container "${name}" kept for inspection`;
};

/**
 * Builds a ResolvedComponent for the cypress test runner using the component registry.
 * Reads image/tag from tests.container config and applies env injections from sibling components.
 */
export const buildCypressComponent = (
  envComponents: readonly string[],
  containerConfig: TestContainerConfig | undefined,
  scaffoldingVersion: string | undefined,
  extraEnv: Readonly<Record<string, string>>,
): ResolvedComponent => {
  const definition = getComponent('cypress');
  if (definition === undefined) {
    throw new Error('cypress component not found in registry');
  }

  const imageOverride = containerConfig?.image ?? DEFAULT_IMAGE_NAME;
  const tagOverride = containerConfig?.tag ?? scaffoldingVersion ?? 'latest';

  const resolved = resolveComponent(definition, {
    image: `${imageOverride}:${tagOverride}`,
    env: extraEnv,
  });

  // Build sibling components (from persisted env) to apply envInjections
  const siblings: readonly ResolvedComponent[] = envComponents
    .map((name) => {
      const def = getComponent(name);
      return def !== undefined ? resolveComponent(def) : undefined;
    })
    .filter((c): c is ResolvedComponent => c !== undefined);

  const allComponents = [...siblings, resolved];
  const injected = applyEnvInjections(allComponents);

  // Return the cypress component with injections applied
  const cypressResult = injected[injected.length - 1];
  if (cypressResult === undefined) {
    throw new Error('Failed to resolve cypress component after env injection');
  }

  return cypressResult;
};

export default class TestsRun extends Command {
  static override description =
    'Run the test Docker image against an active environment. ' +
    'The container attaches to the environment network, streams output in real-time, ' +
    'and the CLI exits with the container exit code. Container is kept after completion for debugging.';

  static override examples = [
    '<%= config.bin %> tests run -c config.yml',
    '<%= config.bin %> tests run -c config.yml --env CYPRESS_SPEC=cypress/e2e/login.cy.ts',
    '<%= config.bin %> tests run -c config.yml --state /ci/workspace/state.json --json',
  ];

  static override flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to jahia-cli config file',
      required: true,
    }),
    state: stateFlag,
    env: Flags.string({
      char: 'e',
      description: 'Additional env var for test container (KEY=VALUE, repeatable). Supports ${VAR:-default}.',
      multiple: true,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(TestsRun);
    const statePath = stateFilePath(flags.state);

    try {
      const activeEnv = await getActiveEnvironment(statePath);
      if (activeEnv === undefined) {
        throw new Error('No active environment found. Create one with "environment create" first.');
      }

      if (activeEnv.provider !== 'docker') {
        throw new Error(`tests run requires a Docker environment. Current provider: ${activeEnv.provider}`);
      }

      const config = await loadConfigFile(resolve(flags.config));
      const containerConfig = config.tests?.container;

      const userEnv = flags.env !== undefined
        ? parseKeyValueArgs(flags.env)
        : {};

      const component = buildCypressComponent(
        activeEnv.components.map((c) => c.name),
        containerConfig,
        config.tests?.scaffolding?.version,
        userEnv,
      );

      const imageRef = `${component.effectiveImage}:${component.effectiveTag}`;
      const name = containerName(activeEnv.name, 'cypress');

      const args = buildRunArgs({
        envName: activeEnv.name,
        componentName: component.definition.name,
        image: component.effectiveImage,
        tag: component.effectiveTag,
        networkName: activeEnv.network,
        ports: component.effectivePorts,
        env: component.effectiveEnv,
        volumes: component.definition.volumes,
        networkAliases: component.effectiveNetworkAliases,
        detached: false,
      });

      if (!flags.json) {
        this.log(formatRunStart(imageRef, activeEnv.network, name));
      }

      // Remove any leftover container from a previous run
      await removeContainer(name);

      // Register SIGINT handler to stop the container on Ctrl+C
      const onSigint = (): void => {
        process.stderr.write(`\n⚠ Interrupted — stopping container "${name}"...\n`);
        void stopContainer(name).finally(() => {
          process.exit(130);
        });
      };

      process.on('SIGINT', onSigint);

      const result = await execa('docker', [...args], {
        stdio: 'inherit',
        reject: false,
      });

      process.removeListener('SIGINT', onSigint);

      const exitCode = result.exitCode ?? 1;

      if (flags.json) {
        this.log(JSON.stringify({
          success: exitCode === 0,
          exitCode,
          container: name,
          image: imageRef,
          network: activeEnv.network,
        }, null, 2));
      } else {
        this.log(formatRunComplete(name, exitCode));
      }

      if (exitCode !== 0) {
        this.exit(exitCode);
      }
    } catch (error: unknown) {
      if (isExecaError(error)) {
        const exitCode = error.exitCode ?? 1;
        if (!flags.json) {
          this.log(formatRunComplete('unknown', exitCode));
        }

        this.exit(exitCode);
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: message }, null, 2));
      } else {
        this.error(message);
      }
    }
  }
}

/**
 * Type guard for ExecaError (has exitCode property).
 */
const isExecaError = (error: unknown): error is ExecaError =>
  error instanceof Error && 'exitCode' in error;
