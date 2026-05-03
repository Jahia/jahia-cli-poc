import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { StateFile } from './types.js';
import { stateFilePath } from './state-file-path.js';

/**
 * Saves the state file to disk.
 * Creates the directory if it does not exist.
 */
export const saveState = async (
  state: StateFile,
  stateDir?: string,
): Promise<void> => {
  const path = stateFilePath(stateDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), 'utf-8');
};
