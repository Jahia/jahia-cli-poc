import { rm } from 'node:fs/promises';

import { stateFilePath } from './state-file-path.js';

/**
 * Deletes the state file from disk.
 * No-op if the file does not exist.
 */
export const deleteState = async (statePath?: string): Promise<void> => {
  const path = stateFilePath(statePath);
  try {
    await rm(path);
  } catch {
    // File may not exist — that's fine
  }
};
