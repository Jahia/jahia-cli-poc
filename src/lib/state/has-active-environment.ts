import { loadState } from './load-state.js';

/**
 * Returns true if there is an active environment in the state file.
 */
export const hasActiveEnvironment = async (stateDir?: string): Promise<boolean> => {
  const state = await loadState(stateDir);
  return state?.environment !== undefined;
};
