import type { PersistedEnvironment } from '../state/types.js';
import type { JahiaCliConfig, ConfigComponent } from './types.js';
import { getComponent } from '../components/index.js';

/**
 * Extracts an exportable configuration from a persisted environment.
 * Strips runtime data (container IDs, timestamps, network names) and
 * excludes transparent infrastructure components (e.g., VictoriaLogs).
 * The result is a minimal spec that can recreate the environment.
 */
export const extractExportableConfig = (environment: PersistedEnvironment): JahiaCliConfig => {
  const filteredComponents: readonly ConfigComponent[] = environment.config.components.filter(
    (component) => {
      const definition = getComponent(component.name);
      return definition !== undefined && !definition.isTransparent;
    },
  );

  return {
    environment: {
      name: environment.config.name,
      provider: environment.config.provider,
      components: filteredComponents,
    },
  };
};
