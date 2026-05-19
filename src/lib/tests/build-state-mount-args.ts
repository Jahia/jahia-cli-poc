import { resolve } from 'node:path';
import { access } from 'node:fs/promises';

import type { BindMount } from '../providers/docker/container.js';
import { CONTAINER_STATE_PATH } from './format-run-output.js';

/**
 * Checks whether a file exists on disk (async, no exceptions).
 */
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Builds the bind mount and env var for mounting the state file into the test container.
 * Returns undefined if the state file does not exist on disk.
 */
export const buildStateMountArgs = async (
  hostStatePath: string,
): Promise<{ readonly bindMount: BindMount; readonly envVar: readonly [string, string] } | undefined> => {
  const absolutePath = resolve(hostStatePath);
  const exists = await fileExists(absolutePath);
  if (!exists) {
    return undefined;
  }

  return {
    bindMount: { host: absolutePath, container: CONTAINER_STATE_PATH, readOnly: true },
    envVar: ['JAHIA_CLI_STATE', CONTAINER_STATE_PATH],
  };
};
