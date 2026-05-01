import type { ComponentOverrides } from '../components/types.js';

/**
 * A component entry in a YAML config file.
 */
export interface ConfigComponent {
  readonly name: string;
  readonly overrides?: ComponentOverrides | undefined;
}

/**
 * The full environment configuration as defined in a YAML file.
 */
export interface EnvironmentConfig {
  readonly name: string;
  readonly provider: string;
  readonly components: readonly ConfigComponent[];
}

/**
 * Raw YAML structure before validation (loose types for parsing).
 */
export interface RawConfig {
  readonly name?: unknown;
  readonly provider?: unknown;
  readonly components?: unknown;
}
