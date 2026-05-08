import type { PersistedEnvironment } from '../state/types.js';
import type { EnvironmentConfig, JahiaCliConfig, ConfigComponent } from './types.js';
import { getComponent } from '../components/index.js';

/**
 * Extracts an exportable EnvironmentConfig from a persisted environment.
 * Strips runtime data (container IDs, timestamps, network names) and
 * excludes transparent infrastructure components (e.g., VictoriaLogs).
 * The result is a minimal spec that can recreate the environment.
 */
export const extractExportableConfig = (environment: PersistedEnvironment): EnvironmentConfig => {
  const filteredComponents: readonly ConfigComponent[] = environment.config.components.filter(
    (component) => {
      const definition = getComponent(component.name);
      return definition !== undefined && !definition.isTransparent;
    },
  );

  return {
    name: environment.config.name,
    provider: environment.config.provider,
    components: filteredComponents,
  };
};

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
