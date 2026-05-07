import { readFile, writeFile } from 'node:fs/promises';

const MANAGED_START = '# --- jahia-cli:managed-start ---';
const MANAGED_END = '# --- jahia-cli:managed-end ---';
const MANAGED_HEADER =
  '# Files below are managed by jahia-cli tests init.\n' +
  '# They are sourced from the remote scaffolding repository.\n' +
  '# Remove a line to "own" that file and stop syncing it from remote.';

export interface GitignoreUpdateResult {
  readonly path: string;
  readonly entriesAdded: number;
  readonly created: boolean;
}

/**
 * Builds the managed section content from a list of file paths.
 */
export const buildManagedSection = (entries: readonly string[]): string => {
  const sorted = [...entries].sort((a, b) => a.localeCompare(b));
  return [MANAGED_START, MANAGED_HEADER, ...sorted, MANAGED_END].join('\n');
};

/**
 * Replaces or appends the managed section in existing gitignore content.
 * Preserves all user-owned content outside the markers.
 */
export const replaceManagedSection = (
  existingContent: string,
  entries: readonly string[],
): string => {
  const managedBlock = buildManagedSection(entries);

  const startIdx = existingContent.indexOf(MANAGED_START);
  const endIdx = existingContent.indexOf(MANAGED_END);

  if (startIdx === -1 || endIdx === -1) {
    const separator = existingContent.length > 0 && !existingContent.endsWith('\n') ? '\n\n' : '\n';
    const prefix = existingContent.length === 0 ? '' : existingContent.trimEnd() + separator;
    return prefix + managedBlock + '\n';
  }

  const before = existingContent.slice(0, startIdx);
  const after = existingContent.slice(endIdx + MANAGED_END.length);

  return before + managedBlock + after;
};

/**
 * Updates (or creates) the local .gitignore file with a managed section
 * containing the specified file entries.
 * Returns the result including how many entries were added.
 */
export const updateGitignore = async (
  gitignorePath: string,
  entries: readonly string[],
): Promise<GitignoreUpdateResult> => {
  const existing = await readFile(gitignorePath, 'utf-8').catch(() => '');
  const created = existing === '';
  const updated = replaceManagedSection(existing, entries);

  await writeFile(gitignorePath, updated, 'utf-8');

  return {
    path: gitignorePath,
    entriesAdded: entries.length,
    created,
  };
};
