import { readFile } from 'node:fs/promises';

import yaml from 'js-yaml';

import type { ResolvedComponent } from '../components/types.js';
import { getComponent, resolveComponent } from '../components/index.js';
import { DEFAULT_PROVIDER, generateEnvName } from './defaults.js';
import type { ConfigComponent, EnvironmentConfig, RawConfig } from './types.js';

/**
 * Validates and parses a raw YAML object into a typed EnvironmentConfig.
 * Throws descriptive errors for invalid configurations.
 */
export const validateConfig = (raw: RawConfig): EnvironmentConfig => {
  const name = typeof raw.name === 'string' ? raw.name : generateEnvName();
  const provider = typeof raw.provider === 'string' ? raw.provider : DEFAULT_PROVIDER;

  if (!Array.isArray(raw.components) || raw.components.length === 0) {
    throw new Error('Configuration must include at least one component in the "components" array.');
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
 * Loads and parses a YAML config file from disk.
 */
export const loadConfigFile = async (filePath: string): Promise<EnvironmentConfig> => {
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
