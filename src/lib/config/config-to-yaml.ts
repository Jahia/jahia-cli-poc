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
 */
export const configToYaml = (config: JahiaCliConfig): string =>
  yaml.dump(
    {
      ...(config.scaffolding === undefined ? {} : { scaffolding: config.scaffolding }),
      ...(config.workflowsFile === undefined ? {} : { workflowsFile: config.workflowsFile }),
      ...(config.environment === undefined
        ? {}
        : { environment: config.environment }),
      ...(config.tests === undefined ? {} : { tests: config.tests }),
      ...(config.workflows === undefined ? {} : { workflows: serializeWorkflows(config.workflows) }),
    },
    {
      lineWidth: -1,
      noRefs: true,
    },
  );
