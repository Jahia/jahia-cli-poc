import type { ComponentOverrides } from '../components/types.js';

/**
 * A component entry in a YAML config file.
 */
export interface ConfigComponent {
  readonly name: string;
  readonly overrides?: ComponentOverrides | undefined;
}

/**
 * Test framework configuration metadata.
 */
export interface TestsConfig {
  readonly 'jahia-cypress'?: string | undefined;
}

/**
 * The environment section of the configuration file.
 */
export interface EnvironmentConfig {
  readonly name: string;
  readonly provider: string;
  readonly components: readonly ConfigComponent[];
}

/**
 * The top-level Jahia CLI configuration file structure.
 * Contains `environment` and `tests` as distinct top-level sections.
 */
export interface JahiaCliConfig {
  readonly environment: EnvironmentConfig;
  readonly tests?: TestsConfig | undefined;
}

/**
 * Raw YAML structure before validation (loose types for parsing).
 */
export interface RawConfig {
  readonly environment?: unknown;
  readonly tests?: unknown;
}

/**
 * Raw environment section before validation.
 */
export interface RawEnvironmentConfig {
  readonly name?: unknown;
  readonly provider?: unknown;
  readonly components?: unknown;
}
