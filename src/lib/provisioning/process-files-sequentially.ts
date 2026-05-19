import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { FileActionType } from './submit-file-action.js';
import { submitFileAction } from './submit-file-action.js';
import type { FileActionResult } from './types.js';

/**
 * Processes files sequentially, stopping on the first failure.
 * Returns all results up to and including the failed one (if any).
 */
export const processFilesSequentially = async (
  filePaths: readonly string[],
  actionType: FileActionType,
  connection: {
    readonly url: string;
    readonly username: string;
    readonly password: string;
  },
): Promise<readonly FileActionResult[]> => {
  const processNext = async (
    remaining: readonly string[],
    accumulated: readonly FileActionResult[],
  ): Promise<readonly FileActionResult[]> => {
    const nextPath = remaining[0];
    if (nextPath === undefined) {
      return accumulated;
    }

    const content = await readFile(nextPath);
    const filename = basename(nextPath);

    const result = await submitFileAction({
      url: connection.url,
      username: connection.username,
      password: connection.password,
      filename,
      content,
      actionType,
    });

    const updated = [...accumulated, result];

    if (!result.success) {
      return updated;
    }

    return processNext(remaining.slice(1), updated);
  };

  return processNext(filePaths, []);
};
