import type { EnvironmentConfig } from '../config/types.js';

/**
 * A persisted component entry — tracks container identity for lifecycle ops.
 */
export interface PersistedComponent {
  readonly name: string;
  readonly image: string;
  readonly tag: string;
  readonly containerId: string;
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
