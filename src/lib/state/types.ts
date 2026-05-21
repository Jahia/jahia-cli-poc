import type { EnvironmentConfig } from '../config/types.js';

/**
 * Full persisted environment state — stored in the state file.
 */
export interface PersistedEnvironment {
  readonly name: string;
  readonly provider: string;
  readonly composePath: string;
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
