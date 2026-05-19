import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';
import { execa, type ExecaError } from 'execa';

import { loadConfigFile } from '../../lib/config/parser.js';
import { buildRunArgs, containerName } from '../../lib/providers/docker/container.js';
import type { BindMount } from '../../lib/providers/docker/container.js';
import { stopContainer } from '../../lib/providers/docker/stop-container.js';
import { removeContainer } from '../../lib/providers/docker/container.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { parseKeyValueArgs } from '../../lib/tests/build-image.js';
import { buildCypressComponent } from '../../lib/tests/build-cypress-component.js';
import { buildStateMountArgs } from '../../lib/tests/build-state-mount-args.js';
import { CONTAINER_STATE_PATH, formatRunComplete, formatRunStart } from '../../lib/tests/format-run-output.js';
import { persistTestContainer } from '../../lib/tests/persist-test-container.js';

// Re-export extracted functions for backward-compatible test imports
export { CONTAINER_STATE_PATH, formatRunComplete, formatRunStart } from '../../lib/tests/format-run-output.js';
export { buildStateMountArgs } from '../../lib/tests/build-state-mount-args.js';
export { persistTestContainer } from '../../lib/tests/persist-test-container.js';
export { buildCypressComponent } from '../../lib/tests/build-cypress-component.js';

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

      // Mount the environment state file into the test container so that
      // jahia-cli inside the container can discover the environment.
      const stateMount = await buildStateMountArgs(statePath);
      const bindMounts: readonly BindMount[] = stateMount !== undefined ? [stateMount.bindMount] : [];
      const stateEnv: Readonly<Record<string, string>> = stateMount !== undefined
        ? { [stateMount.envVar[0]]: stateMount.envVar[1] }
        : {};

      if (stateMount === undefined) {
        this.warn(
          `State file not found at "${statePath}" — skipping mount into test container.\n` +
          `  Commands inside the container that depend on environment state will not work.\n` +
          `  Verify the state file exists or pass --state with a valid path.`,
        );
      } else if (!flags.json) {
        this.log(`📁 Mounting state: ${stateMount.bindMount.host} → ${CONTAINER_STATE_PATH} (read-only)`);
      }

      const args = buildRunArgs({
        envName: activeEnv.name,
        componentName: component.definition.name,
        image: component.effectiveImage,
        tag: component.effectiveTag,
        networkName: activeEnv.network,
        ports: component.effectivePorts,
        env: { ...component.effectiveEnv, ...stateEnv },
        volumes: component.definition.volumes,
        networkAliases: component.effectiveNetworkAliases,
        bindMounts,
        detached: false,
      });

      if (!flags.json) {
        this.log(formatRunStart(imageRef, activeEnv.network, name, stateMount !== undefined
          ? { host: stateMount.bindMount.host, container: CONTAINER_STATE_PATH }
          : undefined));
      }

      // Remove any leftover container from a previous run
      await removeContainer(name);

      // Register SIGINT handler to stop the container on Ctrl+C
      const onSigint = (): void => {
        process.stderr.write(`\n⚠ Interrupted — stopping container "${name}"...\n`);
        void persistTestContainer(
          statePath, name, component.effectiveImage, component.effectiveTag,
          component.effectiveNetworkAliases, component.effectivePorts,
        ).catch(() => { /* best-effort */ }).then(() =>
          stopContainer(name).finally(() => {
            process.exit(130);
          }),
        );
      };

      process.on('SIGINT', onSigint);

      const result = await execa('docker', [...args], {
        stdio: 'inherit',
        reject: false,
      });

      process.removeListener('SIGINT', onSigint);

      // Persist the test container into environment state for artifact collection
      await persistTestContainer(
        statePath, name, component.effectiveImage, component.effectiveTag,
        component.effectiveNetworkAliases, component.effectivePorts,
      );

      const exitCode = result.exitCode ?? 1;

      if (flags.json) {
        this.log(JSON.stringify({
          success: exitCode === 0,
          exitCode,
          container: name,
          image: imageRef,
          network: activeEnv.network,
          stateMount: stateMount !== undefined
            ? { host: stateMount.bindMount.host, container: CONTAINER_STATE_PATH }
            : null,
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
