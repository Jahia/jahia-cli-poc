import { resolve } from 'node:path';

/**
 * Resolves the path to the global workflows file.
 *
 * Precedence:
 * 1. CLI flag value (resolved relative to CWD)
 * 2. Config key value (resolved relative to config file directory)
 * 3. undefined (no global file configured)
 *
 * Note: No default filename auto-discovery — the user must explicitly
 * specify a global workflows file via flag or config key.
 */
export const resolveWorkflowsFilePath = (
  configDir: string,
  configKey: string | undefined,
  flagValue: string | undefined,
): string | undefined => {
  if (flagValue !== undefined) {
    return resolve(flagValue);
  }

  if (configKey !== undefined) {
    return resolve(configDir, configKey);
  }

  return undefined;
};
