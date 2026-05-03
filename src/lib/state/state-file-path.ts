import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Resolves the state file path.
 * Priority: explicit stateDir param > JAHIA_CLI_STATE_DIR env var > default (~/.jahia-cli/).
 */
export const stateFilePath = (stateDir?: string): string => {
  const dir = stateDir ?? process.env['JAHIA_CLI_STATE_DIR'] ?? join(homedir(), '.jahia-cli');
  return join(dir, 'state.json');
};
