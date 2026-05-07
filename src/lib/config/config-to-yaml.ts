import yaml from 'js-yaml';

import type { JahiaCliConfig } from './types.js';

/**
 * Serializes JahiaCliConfig to YAML.
 * Components without overrides are emitted as plain strings for readability.
 */
export const configToYaml = (config: JahiaCliConfig): string =>
  yaml.dump(
    {
      environment: {
        ...config.environment,
        components: config.environment.components.map((component) =>
          component.overrides === undefined
            ? component.name
            : {
                name: component.name,
                overrides: component.overrides,
              },
        ),
      },
      ...(config.tests === undefined ? {} : { tests: config.tests }),
    },
    {
      lineWidth: -1,
      noRefs: true,
    },
  );
