import type { ArtifactMapping } from './types.js';

/**
 * Merges and deduplicates artifact mappings. Override entries replace definition
 * entries with the same `source` path, and new entries are appended.
 */
export const mergeArtifacts = (
  definition: readonly ArtifactMapping[],
  overrides: readonly ArtifactMapping[],
): readonly ArtifactMapping[] => {
  const overrideSources = new Set(overrides.map((o) => o.source));
  const kept = definition.filter((d) => !overrideSources.has(d.source));
  return [...kept, ...overrides];
};
