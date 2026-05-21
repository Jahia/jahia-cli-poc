import type { PersistedEnvironment } from './types.js';
import type { NetworkMode, ResolvedUrl } from './resolve-url-types.js';

/**
 * Default HTTP port used when no port mapping is available.
 */
const FALLBACK_PORT = 8080;

/**
 * Extracts the appropriate port for a service.
 * In docker-compose mode, port mapping is managed externally.
 * Returns the fallback port since service ports are defined in compose files.
 */
export const extractPort = (
  _networkMode: NetworkMode,
  _portIndex: number,
): number => FALLBACK_PORT;

/**
 * Extracts the hostname for the service based on network mode.
 * For host mode → 'localhost'; for docker-network → service name.
 */
export const extractHostname = (
  serviceName: string,
  networkMode: NetworkMode,
): string => networkMode === 'host' ? 'localhost' : serviceName;

/**
 * Resolves a service URL from the persisted environment state.
 * In the docker-compose model, services are referenced by their compose service name.
 * Port mapping is defined in the compose file and is not stored in state.
 *
 * @param serviceName - The service to resolve (e.g. 'jahia', 'pgsql')
 * @param _env - The persisted environment (unused in compose mode)
 * @param networkMode - Whether running on host or inside Docker network
 * @param port - Optional port override (default: FALLBACK_PORT)
 */
export const resolveComponentUrl = (
  serviceName: string,
  _env: PersistedEnvironment | undefined,
  networkMode: NetworkMode,
  port: number = FALLBACK_PORT,
): ResolvedUrl => {
  const hostname = extractHostname(serviceName, networkMode);
  return {
    url: `http://${hostname}:${String(port)}`,
    source: 'default',
    networkMode,
  };
};
