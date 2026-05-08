import { execFile } from 'node:child_process';
import { connect } from 'node:net';
import { promisify } from 'node:util';

import type { ResolvedComponent } from '../../components/types.js';
import { getComponent, listTransparentComponents, resolveComponent } from '../../components/index.js';
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
import type { LogDriverConfig } from './container.js';
import { containerName, inspectContainer, removeContainer, runContainer } from './container.js';
import { startContainer } from './start-container.js';
import { stopContainer } from './stop-container.js';
import { createNetwork, networkExists, networkName, removeNetwork } from './network.js';
import { createVolume } from './volume.js';

const execFileAsync = promisify(execFile);

/**
 * Waits for a TCP port on localhost to accept connections.
 * Used to ensure VictoriaLogs syslog listener is ready before starting
 * containers that use the syslog log driver.
 */
const waitForPort = (port: number, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = (): void => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for port ${String(port)} to accept connections`));
          return;
        }
        setTimeout(attempt, 200);
      });
    };
    attempt();
  });

/**
 * Log driver configuration for forwarding logs to VictoriaLogs via syslog.
 */
const buildLogConfig = (envName: string, syslogPort: number): LogDriverConfig => ({
  driver: 'syslog',
  options: {
    'syslog-address': `tcp://127.0.0.1:${String(syslogPort)}`,
    'syslog-format': 'rfc5424',
    'tag': `jahia-cli-${envName}-{{.Name}}`,
  },
});

/**
 * Resolves transparent infrastructure components that must be auto-deployed.
 */
const resolveTransparentComponents = (): readonly ResolvedComponent[] =>
  listTransparentComponents().map((def) => resolveComponent(def));

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
  const def = getComponent(componentName);

  if (!info) {
    return {
      name: componentName,
      status: 'not_found',
      image: def?.image,
      tag: def?.defaultTag,
      category: def?.category,
    };
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
    image: def?.image,
    tag: def?.defaultTag,
    category: def?.category,
  };
};

/**
 * Starts a single component via docker run, returning its status.
 */
const runSingleComponent = async (
  envName: string,
  netName: string,
  component: ResolvedComponent,
  logConfig?: LogDriverConfig,
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
      logConfig,
      containerArgs: component.definition.args,
    });
    const portMap = Object.fromEntries(
      component.effectivePorts.map((p) => [String(p.container), p.host]),
    );
    return {
      status: {
        name: component.definition.name,
        status: 'running',
        containerId: containerId.slice(0, 12),
        health: component.definition.healthcheck ? 'starting' : 'none',
        ports: Object.keys(portMap).length > 0 ? portMap : undefined,
        image: component.definition.image,
        tag: component.effectiveTag,
        category: component.definition.category,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: {
        name: component.definition.name,
        status: 'stopped',
        image: component.definition.image,
        tag: component.effectiveTag,
        category: component.definition.category,
      },
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
 * Automatically injects transparent infrastructure (VictoriaLogs) into every environment.
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

    // Start transparent infrastructure first (VictoriaLogs) — no log forwarding for itself
    const infraComponents = resolveTransparentComponents();
    const infraResults = await infraComponents.reduce(
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
    const ordered = sortByDependencies(components);
    const userResults = await ordered.reduce(
      async (chainPromise, component) => {
        const chain = await chainPromise;
        const result = await runSingleComponent(envName, netName, component, logConfig);
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
