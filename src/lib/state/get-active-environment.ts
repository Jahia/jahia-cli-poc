import type { PersistedEnvironment } from './types.js';
import { loadState } from './load-state.js';

/**
 * Returns the currently active environment from state, or undefined if none exists.
 */
export const getActiveEnvironment = async (
  statePath?: string,
): Promise<PersistedEnvironment | undefined> => {
  const state = await loadState(statePath);
  return state?.environment;
};
