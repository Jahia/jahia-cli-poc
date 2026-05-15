import { resolve } from 'node:path';

/**
 * Default filename for the global workflows file, looked up in CWD.
 */
export const DEFAULT_WORKFLOWS_FILENAME = 'jahia-cli.workflows.global.yml';

/**
 * Resolves the path to the workflows file.
 *
 * Precedence:
 * 1. CLI flag value (resolved relative to CWD)
 * 2. Config key value (resolved relative to config file directory)
 * 3. Default: jahia-cli.workflows.global.yml in CWD
 *
 * Returns { path, isExplicit } where isExplicit is true when the user
 * explicitly specified a file (via flag or config key) rather than relying on
 * the default. This distinction drives error handling: an explicit file that
 * is missing triggers a warning, while a missing default is silently skipped.
 */
export const resolveWorkflowsFilePath = (
  configDir: string,
  configKey: string | undefined,
  flagValue: string | undefined,
): { readonly path: string; readonly isExplicit: boolean } => {
  if (flagValue !== undefined) {
    return { path: resolve(flagValue), isExplicit: true };
  }

  if (configKey !== undefined) {
    return { path: resolve(configDir, configKey), isExplicit: true };
  }

  return { path: resolve(DEFAULT_WORKFLOWS_FILENAME), isExplicit: false };
};
