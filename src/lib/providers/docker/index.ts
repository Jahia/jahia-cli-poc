import type { ResolvedComponent } from '../../components/types.js';
import type { ComponentStatus, CreateResult, EnvironmentState, HealthCheckResult, Provider } from '../types.js';
import { containerName, inspectContainer, runContainer } from './container.js';
import { createNetwork, networkExists, networkName } from './network.js';
import { createVolume } from './volume.js';

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

  const health = (info.health === 'none' || info.health === 'healthy' || info.health === 'unhealthy' || info.health === 'starting')
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
 * Starts a single component, returning its status.
 */
const startComponent = async (
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

    // Create network
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

    // Sort by dependencies and start containers sequentially
    const ordered = sortByDependencies(components);
    const results = await ordered.reduce(
      async (chainPromise, component) => {
        const chain = await chainPromise;
        const result = await startComponent(envName, netName, component);
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

    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    const prefix = `jahia-cli-${envName}-`;
    const { stdout } = await execFileAsync('docker', [
      'ps', '-a', '--filter', `name=${prefix}`, '--format', '{{.Names}}',
    ]);

    const containerNames = stdout.trim().split('\n').filter(Boolean);
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
