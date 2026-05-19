import type { ResolvedComponent } from '../components/types.js';
import { getComponent, resolveComponent } from '../components/index.js';
import type { EnvironmentConfig } from './types.js';

/**
 * Resolves all components in a config to their full definitions with overrides applied.
 * Throws if any component name is not found in the registry.
 */
export const resolveConfigComponents = (config: EnvironmentConfig): readonly ResolvedComponent[] =>
  config.components.map((entry) => {
    const definition = getComponent(entry.name);
    if (!definition) {
      throw new Error(
        `Unknown component "${entry.name}". Use "jahia-cli environment create --help" to see available components.`,
      );
    }
    return resolveComponent(definition, entry.overrides);
  });
