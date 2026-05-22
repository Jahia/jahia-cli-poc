import { resolveEnvVars } from './resolve-env-vars.js';
import { parseScaffoldingConfig } from './parse-scaffolding-config.js';
import { parseTestsConfig } from './parse-tests-config.js';
import { parseWorkflowsConfig } from './parse-workflows-config.js';
import { validateEnvironmentConfig } from './validate-environment-config.js';
import type { JahiaCliConfig, RawConfig, RawEnvironmentConfig } from './types.js';

/**
 * Validates and parses a raw YAML object into a typed JahiaCliConfig.
 * All sections (environment, tests, workflows) are optional — commands validate
 * the presence of the sections they need.
 *
 * Detects the legacy `workflow:` key and provides a migration error.
 */
export const validateConfig = (raw: RawConfig): JahiaCliConfig => {
  if (raw.workflow !== undefined) {
    throw new Error(
      'Configuration uses the deprecated "workflow:" key.\n' +
      'Rename it to "workflows:" and wrap your workflow in a named entry.\n\n' +
      '  Before:\n' +
      '    workflow:\n' +
      '      steps: [...]\n\n' +
      '  After:\n' +
      '    workflows:\n' +
      '      main:\n' +
      '        default: true\n' +
      '        steps: [...]',
    );
  }

  const rawEnv =
    raw.environment !== undefined && typeof raw.environment === 'object' && raw.environment !== null
      ? (raw.environment as RawEnvironmentConfig)
      : undefined;

  // Only validate environment if it has basic fields.
  // Commands that require environment will check for its presence themselves.
  const environment =
    rawEnv !== undefined && (rawEnv.name !== undefined || rawEnv.provider !== undefined || rawEnv.composePath !== undefined)
      ? validateEnvironmentConfig(rawEnv)
      : undefined;

  const tests = parseTestsConfig(raw.tests);
  const scaffolding = raw.scaffolding !== undefined
    ? parseScaffoldingConfig(raw.scaffolding)
    : undefined;
  const workflows = parseWorkflowsConfig(raw.workflows);
  const workflowsFile =
    typeof raw.workflowsFile === 'string'
      ? resolveEnvVars(raw.workflowsFile)
      : undefined;

  return {
    ...(scaffolding === undefined ? {} : { scaffolding }),
    ...(environment === undefined ? {} : { environment }),
    ...(tests === undefined ? {} : { tests }),
    ...(workflows === undefined ? {} : { workflows }),
    ...(workflowsFile === undefined ? {} : { workflowsFile }),
  };
};
