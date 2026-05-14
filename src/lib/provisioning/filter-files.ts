import { basename } from 'node:path';

import picomatch from 'picomatch';

/**
 * Filters a list of file paths using a glob pattern matched against
 * each file's basename. Returns matching paths sorted alphabetically
 * by basename for reproducible ordering across platforms.
 */
export const filterFiles = (
  filePaths: readonly string[],
  pattern: string,
): readonly string[] => {
  const isMatch = picomatch(pattern);
  return [...filePaths]
    .filter((filePath) => isMatch(basename(filePath)))
    .sort((a, b) => basename(a).localeCompare(basename(b)));
};
