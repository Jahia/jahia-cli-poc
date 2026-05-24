import type { EnvironmentConfig } from './types.js';

/**
 * In the docker-compose model, there are no components to resolve from a registry.
 * Services are defined externally in the scaffolding. This function is kept for API
 * compatibility but simply validates that composePath is set.
 */
export const resolveConfigComponents = (config: EnvironmentConfig): string => {
  if (config.composePath === undefined) {
    throw new Error(
      'No composePath configured. Run "jahia-cli init" to set up the environment scaffolding.',
    );
  }
  return config.composePath;
};
