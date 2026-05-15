import type { EnvironmentConfig } from '../config/types.js';
import type { PortMapping } from '../components/types.js';

/**
 * Endpoint visibility for a component — how to reach it from inside
 * the Docker network ("Docker network") and from the host machine ("Host").
 *
 * `aliases` lists all Docker network aliases the container is reachable by.
 * `ports` lists the container/host port mappings.
 *
 * Derive addresses as:
 *   Docker network:  <aliases[0]>:<port.container>
 *   Host:            localhost:<port.host>
 */
export interface ComponentEndpoints {
  readonly aliases: readonly string[];
  readonly ports: readonly PortMapping[];
}

/**
 * A persisted component entry — tracks container identity for lifecycle ops.
 */
export interface PersistedComponent {
  readonly name: string;
  readonly image: string;
  readonly tag: string;
  readonly containerId: string;
  /** Endpoint info populated at creation time. Optional for backward compat with old state files. */
  readonly endpoints?: ComponentEndpoints | undefined;
}

/**
 * Full persisted environment state — stored in the state file.
 */
export interface PersistedEnvironment {
  readonly name: string;
  readonly provider: string;
  readonly network: string;
  readonly components: readonly PersistedComponent[];
  readonly config: EnvironmentConfig;
  readonly createdAt: string;
  readonly stoppedAt?: string | undefined;
}

/**
 * Top-level state file structure with schema version.
 */
export interface StateFile {
  readonly version: 1;
  readonly environment?: PersistedEnvironment | undefined;
}
