import { generateEnvName, DEFAULT_PROVIDER } from './defaults.js';
import type { EnvironmentConfig, RawEnvironmentConfig } from './types.js';

/**
 * Validates and parses a raw environment section into a typed EnvironmentConfig.
 * Throws descriptive errors for invalid configurations.
 */
export const validateEnvironmentConfig = (raw: RawEnvironmentConfig): EnvironmentConfig => {
  const name = typeof raw.name === 'string' ? raw.name : generateEnvName();
  const provider = typeof raw.provider === 'string' ? raw.provider : DEFAULT_PROVIDER;
  const composePath = typeof raw.composePath === 'string' ? raw.composePath : undefined;

  return { name, provider, composePath };
};
