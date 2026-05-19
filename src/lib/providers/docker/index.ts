import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ResolvedComponent } from '../../components/types.js';
import { applyEnvInjections, listTransparentComponents, resolveComponent } from '../../components/index.js';
import type {
  ComponentStatus,
  CreateResult,
  DestroyResult,
  EnvironmentState,
  HealthCheckResult,
  Provider,
  StartResult,
  StopResult,
} from '../types.js';
import { removeContainer } from './container.js';
import { startContainer } from './start-container.js';
import { stopContainer } from './stop-container.js';
import { createNetwork, networkExists, networkName, removeNetwork } from './network.js';
import { buildLogConfig } from './build-log-config.js';
import { getComponentStatus } from './get-component-status.js';
import { listEnvironmentContainers, listEnvironmentVolumes } from './list-environment-resources.js';
import { runSingleComponent } from './run-single-component.js';
import { sortByDependencies } from './sort-by-dependencies.js';
import { waitForPort } from './wait-for-port.js';

const execFileAsync = promisify(execFile);

/**
 * Resolves transparent infrastructure components that must be auto-deployed.
 */
const resolveTransparentComponents = (): readonly ResolvedComponent[] =>
  listTransparentComponents().map((def) => resolveComponent(def));

/**
 * Docker provider implementation.
 * Manages environments using native Docker CLI commands.
 * Automatically injects transparent infrastructure (VictoriaLogs) into every environment.
 */
export const dockerProvider: Provider = {
  name: 'docker',

  createEnvironment: async (
    envName: string,
    components: readonly ResolvedComponent[],
    onProgress?: (message: string) => void,
  ): Promise<CreateResult> => {
    const netName = networkName(envName);

    try {
      const exists = await networkExists(envName);
      if (!exists) {
        await createNetwork(envName);
      } else {
        onProgress?.(`Network ${netName} already exists, reusing`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        environment: { name: envName, provider: 'docker', network: netName, components: [] },
        errors: [`Failed to create network: ${msg}`],
      };
    }

    // Start transparent infrastructure first (VictoriaLogs) — no log forwarding for itself
    const infraComponents = resolveTransparentComponents();
    const infraResults = await infraComponents.reduce(
      async (chainPromise, component) => {
        const chain = await chainPromise;
        const result = await runSingleComponent(envName, netName, component, undefined, onProgress);
        return {
          statuses: [...chain.statuses, result.status],
          errors: result.error ? [...chain.errors, result.error] : chain.errors,
        };
      },
      Promise.resolve({ statuses: [] as ComponentStatus[], errors: [] as string[] }),
    );

    // If infrastructure failed, abort early
    if (infraResults.errors.length > 0) {
      return {
        success: false,
        environment: {
          name: envName,
          provider: 'docker',
          network: netName,
          components: infraResults.statuses,
          createdAt: new Date().toISOString(),
        },
        errors: infraResults.errors,
      };
    }

    // Start user components with log forwarding to VictoriaLogs
    // Find the syslog port from the VictoriaLogs infrastructure component
    const vlComponent = infraComponents.find((c) => c.definition.name === 'victorialogs');
    const syslogPort = vlComponent?.effectivePorts.find((p) => p.container === 5140)?.host ?? 5140;

    // Wait for VictoriaLogs syslog port to accept connections before starting user containers.
    // Docker's syslog log driver connects at container creation time — if the port isn't ready,
    // docker run will fail with "failed to initialize logging driver".
    await waitForPort(syslogPort, 15000);

    const logConfig = buildLogConfig(envName, syslogPort);
    const injectedComponents = applyEnvInjections(components);
    const ordered = sortByDependencies(injectedComponents);
    const userResults = await ordered.reduce(
      async (chainPromise, component) => {
        const chain = await chainPromise;
        const result = await runSingleComponent(envName, netName, component, logConfig, onProgress);
        return {
          statuses: [...chain.statuses, result.status],
          errors: result.error ? [...chain.errors, result.error] : chain.errors,
        };
      },
      Promise.resolve({ statuses: [] as ComponentStatus[], errors: [] as string[] }),
    );

    const allStatuses = [...infraResults.statuses, ...userResults.statuses];
    const allErrors = [...infraResults.errors, ...userResults.errors];

    return {
      success: allErrors.length === 0,
      environment: {
        name: envName,
        provider: 'docker',
        network: netName,
        components: allStatuses,
        createdAt: new Date().toISOString(),
      },
      errors: allErrors,
    };
  },

  stopEnvironment: async (envName: string): Promise<StopResult> => {
    const containers = await listEnvironmentContainers(envName);
    const errors: string[] = [];
    const stopped: string[] = [];

    // Stop in reverse order (dependents first)
    const reversed = [...containers].reverse();
    await reversed.reduce(async (chain, name) => {
      await chain;
      try {
        await stopContainer(name);
        stopped.push(name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to stop ${name}: ${msg}`);
      }
    }, Promise.resolve());

    return {
      success: errors.length === 0,
      stoppedComponents: stopped,
      errors,
    };
  },

  startEnvironment: async (envName: string): Promise<StartResult> => {
    const containers = await listEnvironmentContainers(envName);
    const errors: string[] = [];
    const started: string[] = [];

    // Start in order (dependencies first)
    await containers.reduce(async (chain, name) => {
      await chain;
      try {
        await startContainer(name);
        started.push(name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to start ${name}: ${msg}`);
      }
    }, Promise.resolve());

    return {
      success: errors.length === 0,
      startedComponents: started,
      errors,
    };
  },

  destroyEnvironment: async (envName: string): Promise<DestroyResult> => {
    const containers = await listEnvironmentContainers(envName);
    const errors: string[] = [];
    const removedComponents: string[] = [];

    // Remove containers
    await containers.reduce(async (chain, name) => {
      await chain;
      try {
        await removeContainer(name);
        removedComponents.push(name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to remove container ${name}: ${msg}`);
      }
    }, Promise.resolve());

    // Remove network
    const removedNetwork = await removeNetwork(envName)
      .then(() => true)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push('Failed to remove network: ' + msg);
        return false;
      });

    // Remove volumes
    const volumes = await listEnvironmentVolumes(envName);
    const removedVolumes: string[] = [];
    await volumes.reduce(async (chain, volName) => {
      await chain;
      try {
        await execFileAsync('docker', ['volume', 'rm', '-f', volName]);
        removedVolumes.push(volName);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to remove volume ${volName}: ${msg}`);
      }
    }, Promise.resolve());

    return {
      success: errors.length === 0,
      removedComponents,
      removedNetwork,
      removedVolumes,
      errors,
    };
  },

  getEnvironmentStatus: async (envName: string): Promise<EnvironmentState> => {
    const hasNetwork = await networkExists(envName);
    if (!hasNetwork) {
      return {
        name: envName,
        provider: 'docker',
        network: networkName(envName),
        components: [],
      };
    }

    const containerNames = await listEnvironmentContainers(envName);
    const prefix = `jahia-cli-${envName}-`;
    const componentNames = containerNames.map((n) => n.replace(prefix, ''));

    const statuses = await Promise.all(
      componentNames.map((name) => getComponentStatus(envName, name)),
    );

    return {
      name: envName,
      provider: 'docker',
      network: networkName(envName),
      components: statuses,
    };
  },

  checkHealth: async (envName: string): Promise<HealthCheckResult> => {
    const state = await dockerProvider.getEnvironmentStatus(envName);

    const passingHealthStatuses = new Set(['healthy', 'none', 'starting']);

    const checks = state.components.map((comp) => ({
      name: comp.name,
      passed: comp.status === 'running' && passingHealthStatuses.has(comp.health ?? 'none'),
      message:
        comp.status === 'not_found'
          ? 'Container not found'
          : comp.status === 'stopped'
            ? 'Container is stopped'
            : comp.health === 'healthy' || comp.health === 'none'
              ? 'Healthy'
              : comp.health === 'starting'
                ? 'Starting (healthcheck pending)'
                : `Health status: ${comp.health ?? 'unknown'}`,
    }));

    return {
      success: checks.every((c) => c.passed),
      environment: state,
      checks,
    };
  },
};
