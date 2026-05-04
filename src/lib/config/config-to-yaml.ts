import yaml from 'js-yaml';

import type { EnvironmentConfig } from './types.js';

/**
 * Serializes EnvironmentConfig to YAML.
 * Components without overrides are emitted as plain strings for readability.
 */
export const configToYaml = (config: EnvironmentConfig): string =>
  yaml.dump(
    {
      ...config,
      components: config.components.map((component) =>
        component.overrides === undefined
          ? component.name
          : {
              name: component.name,
              overrides: component.overrides,
            },
      ),
    },
    {
      lineWidth: -1,
      noRefs: true,
    },
  );
