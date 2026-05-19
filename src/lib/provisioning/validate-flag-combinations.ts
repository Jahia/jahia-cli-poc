import type { ProvisionMode } from './detect-provision-mode.js';

/**
 * Validates flag combinations for cross-flag business rules.
 */
export const validateFlagCombinations = (
  mode: ProvisionMode,
  flags: {
    readonly assets: string | undefined;
    readonly file: readonly string[] | undefined;
    readonly filter: string | undefined;
  },
): void => {
  if (mode !== 'manifest' && flags.assets !== undefined) {
    throw new Error('--assets can only be used with --manifest mode.');
  }

  if (mode !== 'manifest' && flags.file !== undefined && flags.file.length > 0) {
    throw new Error('--file can only be used with --manifest mode.');
  }

  if (flags.filter !== undefined && mode === 'manifest' && flags.assets === undefined) {
    throw new Error('--filter requires --assets when used with --manifest mode.');
  }
};
