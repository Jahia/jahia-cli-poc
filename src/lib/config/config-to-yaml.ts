import yaml from 'js-yaml';

import type { JahiaCliConfig } from './types.js';

/**
 * Serializes a workflows map for YAML output.
 * Each named workflow is serialized with its steps (and optional default flag).
 */
const serializeWorkflows = (
  workflows: Readonly<Record<string, { readonly default?: boolean | undefined; readonly steps: readonly unknown[] }>>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(workflows).map(([name, wf]) => [
      name,
      {
        ...(wf.default === true ? { default: true } : {}),
        steps: wf.steps,
      },
    ]),
  );

/**
 * Serializes JahiaCliConfig to YAML.
 * Components without overrides are emitted as plain strings for readability.
 */
export const configToYaml = (config: JahiaCliConfig): string =>
  yaml.dump(
    {
      ...(config.workflowsFile === undefined ? {} : { workflowsFile: config.workflowsFile }),
      ...(config.environment === undefined
        ? {}
        : {
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
          }),
      ...(config.tests === undefined ? {} : { tests: config.tests }),
      ...(config.workflows === undefined ? {} : { workflows: serializeWorkflows(config.workflows) }),
    },
    {
      lineWidth: -1,
      noRefs: true,
    },
  );
