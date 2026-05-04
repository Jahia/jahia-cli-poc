import { readFile } from 'node:fs/promises';

import type { StateFile } from './types.js';
import { stateFilePath } from './state-file-path.js';

/**
 * Loads the state file from disk.
 * Returns undefined if the file does not exist or is unreadable.
 */
export const loadState = async (statePath?: string): Promise<StateFile | undefined> => {
  const path = stateFilePath(statePath);
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as StateFile;
  } catch {
    return undefined;
  }
};
