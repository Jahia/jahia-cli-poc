/**
 * Files and patterns that should never be synced from the remote scaffolding.
 * These are files that could alter local git behavior or conflict with local config.
 */
export const DEFAULT_EXCLUSION_PATTERNS: readonly string[] = [
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
];

/**
 * Returns true if the given relative path should be excluded from sync.
 * Checks if the filename (last segment) matches any exclusion pattern.
 */
export const isExcluded = (
  relativePath: string,
  exclusionPatterns: readonly string[] = DEFAULT_EXCLUSION_PATTERNS,
): boolean =>
  exclusionPatterns.some((pattern) => {
    const segments = relativePath.split('/');
    const fileName = segments[segments.length - 1] ?? '';
    return fileName === pattern;
  });
