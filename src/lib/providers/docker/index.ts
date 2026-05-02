import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ResolvedComponent } from '../../components/types.js';
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
import { containerName, inspectContainer, removeContainer, runContainer } from './container.js';
import { startContainer } from './start-container.js';
import { stopContainer } from './stop-container.js';
import { createNetwork, networkExists, networkName, removeNetwork } from './network.js';
import { createVolume } from './volume.js';

const execFileAsync = promisify(execFile);

/**
 * Sorts components by dependency order (topological sort).
 * Components with no dependencies come first.
 */
const sortByDependencies = (
  components: readonly ResolvedComponent[],
): readonly ResolvedComponent[] => {
  const sorted: ResolvedComponent[] = [];
  const visited = new Set<string>();
  const componentMap = new Map(components.map((c) => [c.definition.name, c]));

  const visit = (component: ResolvedComponent): void => {
    if (visited.has(component.definition.name)) return;
    visited.add(component.definition.name);

    component.definition.dependsOn.forEach((depName) => {
      const dep = componentMap.get(depName);
      if (dep) visit(dep);
    });

    sorted.push(component);
  };

  components.forEach((c) => {
    visit(c);
  });

  return sorted;
};

/**
 * Creates all volumes needed by a component.
 */
const createComponentVolumes = async (
  envName: string,
  component: ResolvedComponent,
): Promise<void> => {
  await component.definition.volumes.reduce(
    (chain, vol) => chain.then(() => createVolume(envName, vol.name)).then(() => undefined),
    Promise.resolve(),
  );
};

/**
 * Gets the status of a single component container.
 */
const getComponentStatus = async (
  envName: string,
  componentName: string,
): Promise<ComponentStatus> => {
  const name = containerName(envName, componentName);
  const info = await inspectContainer(name);

  if (!info) {
    return { name: componentName, status: 'not_found' };
  }

  const health =
    info.health === 'none' ||
    info.health === 'healthy' ||
    info.health === 'unhealthy' ||
    info.health === 'starting'
      ? info.health
      : undefined;

  return {
    name: componentName,
    status: info.running ? 'running' : 'stopped',
    containerId: info.id.slice(0, 12),
    health,
  };
};

/**
 * Starts a single component via docker run, returning its status.
 */
const runSingleComponent = async (
  envName: string,
  netName: string,
  component: ResolvedComponent,
): Promise<{ status: ComponentStatus; error?: string | undefined }> => {
  try {
    await createComponentVolumes(envName, component);
    const containerId = await runContainer({
      envName,
      componentName: component.definition.name,
      image: component.definition.image,
      tag: component.effectiveTag,
      networkName: netName,
      ports: component.effectivePorts,
      env: component.effectiveEnv,
      volumes: component.definition.volumes,
      networkAliases: component.definition.networkAliases,
      healthcheck: component.definition.healthcheck,
    });
    return {
      status: {
        name: component.definition.name,
        status: 'running',
        containerId: containerId.slice(0, 12),
        health: component.definition.healthcheck ? 'starting' : 'none',
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: { name: component.definition.name, status: 'stopped' },
      error: `Failed to start ${component.definition.name}: ${msg}`,
    };
  }
};

/**
 * Lists container names matching the environment prefix.
 */
const listEnvironmentContainers = async (envName: string): Promise<readonly string[]> => {
  const prefix = `jahia-cli-${envName}-`;
  try {
    const { stdout } = await execFileAsync('docker', [
      'ps',
      '-a',
      '--filter',
      `name=${prefix}`,
      '--format',
      '{{.Names}}',
    ]);
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * Lists volume names matching the environment prefix.
 */
const listEnvironmentVolumes = async (envName: string): Promise<readonly string[]> => {
  const prefix = `jahia-cli-${envName}-`;
  try {
    const { stdout } = await execFileAsync('docker', [
      'volume',
      'ls',
      '--filter',
      `name=${prefix}`,
      '--format',
      '{{.Name}}',
    ]);
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * Docker provider implementation.
 * Manages environments using native Docker CLI commands.
 */
export const dockerProvider: Provider = {
  name: 'docker',

  createEnvironment: async (
    envName: string,
    components: readonly ResolvedComponent[],
  ): Promise<CreateResult> => {
    const netName = networkName(envName);

    try {
      await createNetwork(envName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        environment: { name: envName, provider: 'docker', network: netName, components: [] },
        errors: [`Failed to create network: ${msg}`],
      };
    }

    const ordered = sortByDependencies(components);
    const results = await ordered.reduce(
      async (chainPromise, component) => {
        const chain = await chainPromise;
        const result = await runSingleComponent(envName, netName, component);
        return {
          statuses: [...chain.statuses, result.status],
          errors: result.error ? [...chain.errors, result.error] : chain.errors,
        };
      },
      Promise.resolve({ statuses: [] as ComponentStatus[], errors: [] as string[] }),
    );

    return {
      success: results.errors.length === 0,
      environment: {
        name: envName,
        provider: 'docker',
        network: netName,
        components: results.statuses,
        createdAt: new Date().toISOString(),
      },
      errors: results.errors,
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
    let removedNetwork = false;
    try {
      await removeNetwork(envName);
      removedNetwork = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to remove network: ${msg}`);
    }

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

    const checks = state.components.map((comp) => ({
      name: comp.name,
      passed: comp.status === 'running' && (comp.health === 'healthy' || comp.health === 'none'),
      message:
        comp.status === 'not_found'
          ? 'Container not found'
          : comp.status === 'stopped'
            ? 'Container is stopped'
            : comp.health === 'healthy' || comp.health === 'none'
              ? 'Healthy'
              : `Health status: ${comp.health ?? 'unknown'}`,
    }));

    return {
      success: checks.every((c) => c.passed),
      environment: state,
      checks,
    };
  },
};
