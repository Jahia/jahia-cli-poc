import { generateEnvName, DEFAULT_PROVIDER } from './defaults.js';
import { resolveComponentOverrides } from './resolve-component-overrides.js';
import type { ConfigComponent, EnvironmentConfig, RawEnvironmentConfig } from './types.js';

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
      const rawOverrides = obj['overrides'] as Record<string, unknown> | undefined;
      const resolvedOverrides = rawOverrides !== undefined
        ? resolveComponentOverrides(rawOverrides)
        : undefined;
      return {
        name: obj['name'],
        overrides: resolvedOverrides as ConfigComponent['overrides'],
      };
    }
    throw new Error(
      `Component at index ${String(index)} must be a string or an object with a "name" field.`,
    );
  });

  return { name, provider, components };
};
