import type { StateFile } from '../state/types.js';
import type { EnvironmentConfig } from './types.js';

/**
 * Extracts an EnvironmentConfig from persisted state.
 * Throws when no active environment config is present.
 */
export const buildConfigFromState = (state: StateFile | undefined): EnvironmentConfig => {
  const config = state?.environment?.config;
  if (!config) {
    throw new Error(
      'No active environment configuration found in state file. Use --blank to generate an empty config.',
    );
  }
  return config;
};
