import {
  DEFAULT_SCAFFOLDING_PATH,
  DEFAULT_SCAFFOLDING_REPOSITORY,
  DEFAULT_SCAFFOLDING_VERSION,
} from './defaults.js';
import type { ScaffoldingConfig } from './types.js';

/**
 * Parses and validates the optional scaffolding section at root level.
 */
export const parseScaffoldingConfig = (rawScaffolding: unknown): ScaffoldingConfig => {
  if (typeof rawScaffolding !== 'object' || rawScaffolding === null || Array.isArray(rawScaffolding)) {
    throw new Error('Configuration "scaffolding" must be an object when provided.');
  }

  const record = rawScaffolding as Record<string, unknown>;

  if (record['repository'] !== undefined && typeof record['repository'] !== 'string') {
    throw new Error('Configuration "scaffolding.repository" must be a string when provided.');
  }
  if (record['path'] !== undefined && typeof record['path'] !== 'string') {
    throw new Error('Configuration "scaffolding.path" must be a string when provided.');
  }
  if (record['version'] !== undefined && typeof record['version'] !== 'string') {
    throw new Error('Configuration "scaffolding.version" must be a string when provided.');
  }

  return {
    repository: typeof record['repository'] === 'string' ? record['repository'] : DEFAULT_SCAFFOLDING_REPOSITORY,
    path: typeof record['path'] === 'string' ? record['path'] : DEFAULT_SCAFFOLDING_PATH,
    version: typeof record['version'] === 'string' ? record['version'] : DEFAULT_SCAFFOLDING_VERSION,
  };
};
