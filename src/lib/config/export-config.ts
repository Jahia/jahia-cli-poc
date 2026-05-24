import type { PersistedEnvironment } from '../state/types.js';
import type { EnvironmentConfig, JahiaCliConfig } from './types.js';

/**
 * Extracts an exportable EnvironmentConfig from a persisted environment.
 * In the docker-compose model, the config is already minimal.
 */
export const extractExportableConfig = (environment: PersistedEnvironment): EnvironmentConfig => ({
  name: environment.config.name,
  provider: environment.config.provider,
  composePath: environment.config.composePath,
});

/**
 * Merges an exported environment config into an existing JahiaCliConfig,
 * replacing only the environment section and preserving all other properties.
 */
export const mergeEnvironmentIntoConfig = (
  existing: JahiaCliConfig,
  environmentConfig: EnvironmentConfig,
): JahiaCliConfig => ({
  ...existing,
  environment: environmentConfig,
});
