import type { ComponentEndpoints, PersistedEnvironment } from './types.js';
import type { NetworkMode, ResolvedUrl } from './resolve-url-types.js';
import { COMPONENT_REGISTRY } from '../components/index.js';

/**
 * Default HTTP port used when no port mapping is available.
 */
const FALLBACK_PORT = 8080;

/**
 * Extracts the appropriate port number from endpoints based on network mode.
 * For host mode → host port; for docker-network → container port.
 * Uses portIndex to select among multiple port mappings (default: 0 = first port).
 */
export const extractPort = (
  endpoints: ComponentEndpoints | undefined,
  networkMode: NetworkMode,
  portIndex: number,
): number | undefined => {
  const mapping = endpoints?.ports[portIndex];
  if (mapping === undefined) {
    return undefined;
  }

  return networkMode === 'host' ? mapping.host : mapping.container;
};

/**
 * Extracts the hostname for the component based on network mode.
 * For host mode → 'localhost'; for docker-network → first alias.
 */
export const extractHostname = (
  endpoints: ComponentEndpoints | undefined,
  networkMode: NetworkMode,
): string => {
  if (networkMode === 'host') {
    return 'localhost';
  }

  const alias = endpoints?.aliases[0];
  return alias ?? 'localhost';
};

/**
 * Resolves a component URL from the persisted environment state.
 *
 * Fallback chain for port:
 *   1. Persisted endpoints in state file (populated at environment create)
 *   2. Config override ports from the environment config
 *   3. Component definition defaults from the registry
 *   4. Hardcoded FALLBACK_PORT (8080)
 *
 * Fallback chain for hostname (docker-network mode only):
 *   1. Persisted endpoint aliases
 *   2. Component definition networkAliases from the registry
 *   3. 'localhost'
 *
 * @param componentName - The component to resolve (e.g. 'jahia', 'pgsql')
 * @param env - The persisted environment (or undefined if no state)
 * @param networkMode - Whether running on host or inside Docker network
 * @param portIndex - Which port mapping to use (default: 0 = primary port)
 */
export const resolveComponentUrl = (
  componentName: string,
  env: PersistedEnvironment | undefined,
  networkMode: NetworkMode,
  portIndex = 0,
): ResolvedUrl => {
  if (env === undefined) {
    return {
      url: `http://localhost:${String(FALLBACK_PORT)}`,
      source: 'default',
      networkMode,
    };
  }

  const persisted = env.components.find(
    (c) => c.name === componentName,
  );

  // Try persisted endpoints first
  const endpointPort = extractPort(persisted?.endpoints, networkMode, portIndex);
  const endpointHostname = extractHostname(persisted?.endpoints, networkMode);

  if (endpointPort !== undefined) {
    // In docker-network mode with no aliases, fall back to component name as hostname
    const hostname = (networkMode === 'docker-network' && endpointHostname === 'localhost')
      ? componentName
      : endpointHostname;
    return {
      url: `http://${hostname}:${String(endpointPort)}`,
      source: 'state',
      networkMode,
    };
  }

  // Fallback: config override ports
  const configComponent = env.config.components.find((c) => c.name === componentName);
  const configPort = configComponent?.overrides?.ports?.[portIndex];
  if (configPort !== undefined) {
    const port = networkMode === 'host' ? configPort.host : configPort.container;
    const hostname = networkMode === 'host' ? 'localhost' : (persisted?.endpoints?.aliases[0] ?? componentName);
    return {
      url: `http://${hostname}:${String(port)}`,
      source: 'state',
      networkMode,
    };
  }

  // Fallback: component definition defaults from registry
  const definition = COMPONENT_REGISTRY[componentName];
  if (definition !== undefined) {
    const defPort = definition.ports[portIndex];
    if (defPort !== undefined) {
      const port = networkMode === 'host' ? defPort.host : defPort.container;
      const hostname = networkMode === 'host'
        ? 'localhost'
        : (persisted?.endpoints?.aliases[0] ?? definition.networkAliases[0] ?? componentName);
      return {
        url: `http://${hostname}:${String(port)}`,
        source: 'default',
        networkMode,
      };
    }
  }

  // Final fallback
  return {
    url: `http://localhost:${String(FALLBACK_PORT)}`,
    source: 'default',
    networkMode,
  };
};
