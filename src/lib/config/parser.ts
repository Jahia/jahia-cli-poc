import { readFile } from 'node:fs/promises';

import yaml from 'js-yaml';

import type { ResolvedComponent } from '../components/types.js';
import { getComponent, resolveComponent } from '../components/index.js';
import {
  DEFAULT_PROVIDER,
  DEFAULT_SCAFFOLDING_PATH,
  DEFAULT_SCAFFOLDING_REPOSITORY,
  DEFAULT_SCAFFOLDING_VERSION,
  generateEnvName,
} from './defaults.js';
import type {
  ConfigComponent,
  EnvironmentConfig,
  JahiaCliConfig,
  RawConfig,
  RawEnvironmentConfig,
  ScaffoldingConfig,
  TestsConfig,
  WorkflowConfig,
  WorkflowStep,
} from './types.js';

/**
 * Parses and validates the optional scaffolding section within tests.
 */
export const parseScaffoldingConfig = (rawScaffolding: unknown): ScaffoldingConfig => {
  if (typeof rawScaffolding !== 'object' || rawScaffolding === null || Array.isArray(rawScaffolding)) {
    throw new Error('Configuration "tests.scaffolding" must be an object when provided.');
  }

  const record = rawScaffolding as Record<string, unknown>;

  if (record['repository'] !== undefined && typeof record['repository'] !== 'string') {
    throw new Error('Configuration "tests.scaffolding.repository" must be a string when provided.');
  }
  if (record['path'] !== undefined && typeof record['path'] !== 'string') {
    throw new Error('Configuration "tests.scaffolding.path" must be a string when provided.');
  }
  if (record['version'] !== undefined && typeof record['version'] !== 'string') {
    throw new Error('Configuration "tests.scaffolding.version" must be a string when provided.');
  }

  return {
    repository: typeof record['repository'] === 'string' ? record['repository'] : DEFAULT_SCAFFOLDING_REPOSITORY,
    path: typeof record['path'] === 'string' ? record['path'] : DEFAULT_SCAFFOLDING_PATH,
    version: typeof record['version'] === 'string' ? record['version'] : DEFAULT_SCAFFOLDING_VERSION,
  };
};

/**
 * Parses and validates the optional tests section.
 */
export const parseTestsConfig = (rawTests: unknown): TestsConfig | undefined => {
  if (rawTests === undefined) {
    return undefined;
  }

  if (typeof rawTests !== 'object' || rawTests === null || Array.isArray(rawTests)) {
    throw new Error('Configuration "tests" field must be an object when provided.');
  }

  const testsRecord = rawTests as Record<string, unknown>;
  const jahiaCypress = testsRecord['jahia-cypress'];

  if (jahiaCypress !== undefined && typeof jahiaCypress !== 'string') {
    throw new Error('Configuration "tests.jahia-cypress" must be a string when provided.');
  }

  const scaffolding =
    testsRecord['scaffolding'] !== undefined
      ? parseScaffoldingConfig(testsRecord['scaffolding'])
      : undefined;

  return {
    ...(jahiaCypress === undefined ? {} : { 'jahia-cypress': jahiaCypress }),
    ...(scaffolding === undefined ? {} : { scaffolding }),
  };
};

/**
 * Validates and parses a raw environment section into a typed EnvironmentConfig.
 * Throws descriptive errors for invalid configurations.
 */
export const validateEnvironmentConfig = (raw: RawEnvironmentConfig): EnvironmentConfig => {
  const name = typeof raw.name === 'string' ? raw.name : generateEnvName();
  const provider = typeof raw.provider === 'string' ? raw.provider : DEFAULT_PROVIDER;

  if (!Array.isArray(raw.components) || raw.components.length === 0) {
    throw new Error(
      'Configuration "environment" must include at least one component in the "components" array.',
    );
  }

  const components: ConfigComponent[] = (raw.components as unknown[]).map((entry, index) => {
    if (typeof entry === 'string') {
      return { name: entry };
    }
    if (typeof entry === 'object' && entry !== null && 'name' in entry) {
      const obj = entry as Record<string, unknown>;
      if (typeof obj['name'] !== 'string') {
        throw new Error(`Component at index ${String(index)} must have a string "name" field.`);
      }
      return {
        name: obj['name'],
        overrides: obj['overrides'] as ConfigComponent['overrides'],
      };
    }
    throw new Error(
      `Component at index ${String(index)} must be a string or an object with a "name" field.`,
    );
  });

  return { name, provider, components };
};

/**
 * Validates a single workflow step entry.
 * Each step must have either `run` (shell command) or `uses` (CLI command), not both.
 */
export const validateWorkflowStep = (raw: unknown, index: number): WorkflowStep => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Workflow step at index ${String(index)} must be an object.`);
  }

  const record = raw as Record<string, unknown>;
  const name = typeof record['name'] === 'string' ? record['name'] : undefined;
  const run = typeof record['run'] === 'string' ? record['run'] : undefined;
  const uses = typeof record['uses'] === 'string' ? record['uses'] : undefined;
  const workingDir = typeof record['working_dir'] === 'string' ? record['working_dir'] : undefined;

  if (run === undefined && uses === undefined) {
    throw new Error(
      `Workflow step at index ${String(index)} must have either "run" (shell command) or "uses" (CLI command).`,
    );
  }

  if (run !== undefined && uses !== undefined) {
    throw new Error(
      `Workflow step at index ${String(index)} must have either "run" or "uses", not both.`,
    );
  }

  const withRecord =
    record['with'] !== undefined && typeof record['with'] === 'object' && record['with'] !== null && !Array.isArray(record['with'])
      ? (record['with'] as Record<string, string>)
      : undefined;

  return {
    ...(name === undefined ? {} : { name }),
    ...(run === undefined ? {} : { run }),
    ...(uses === undefined ? {} : { uses }),
    ...(withRecord === undefined ? {} : { with: withRecord }),
    ...(workingDir === undefined ? {} : { working_dir: workingDir }),
  };
};

/**
 * Parses and validates the optional workflow section.
 */
export const parseWorkflowConfig = (rawWorkflow: unknown): WorkflowConfig | undefined => {
  if (rawWorkflow === undefined) {
    return undefined;
  }

  if (typeof rawWorkflow !== 'object' || rawWorkflow === null || Array.isArray(rawWorkflow)) {
    throw new Error('Configuration "workflow" field must be an object when provided.');
  }

  const record = rawWorkflow as Record<string, unknown>;

  if (!Array.isArray(record['steps'])) {
    throw new Error('Configuration "workflow" must include a "steps" array.');
  }

  if (record['steps'].length === 0) {
    throw new Error('Configuration "workflow.steps" must contain at least one step.');
  }

  const steps: readonly WorkflowStep[] = (record['steps'] as unknown[]).map(
    (entry, index) => validateWorkflowStep(entry, index),
  );

  return { steps };
};

/**
 * Validates and parses a raw YAML object into a typed JahiaCliConfig.
 * All sections (environment, tests, workflow) are optional — commands validate
 * the presence of the sections they need.
 */
export const validateConfig = (raw: RawConfig): JahiaCliConfig => {
  const rawEnv =
    raw.environment !== undefined && typeof raw.environment === 'object' && raw.environment !== null
      ? (raw.environment as RawEnvironmentConfig)
      : undefined;

  // Only validate environment if it has a non-empty components array.
  // Commands that require environment will check for its presence themselves.
  const environment =
    rawEnv !== undefined && Array.isArray(rawEnv.components) && rawEnv.components.length > 0
      ? validateEnvironmentConfig(rawEnv)
      : undefined;

  const tests = parseTestsConfig(raw.tests);
  const workflow = parseWorkflowConfig(raw.workflow);

  return {
    ...(environment === undefined ? {} : { environment }),
    ...(tests === undefined ? {} : { tests }),
    ...(workflow === undefined ? {} : { workflow }),
  };
};

/**
 * Loads and parses a YAML config file from disk.
 */
export const loadConfigFile = async (filePath: string): Promise<JahiaCliConfig> => {
  const content = await readFile(filePath, 'utf-8');
  const raw = yaml.load(content) as RawConfig;
  return validateConfig(raw);
};

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
