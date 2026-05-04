import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Resolves the state file path.
 * Priority: explicit statePath param > JAHIA_CLI_STATE env var >
 * JAHIA_CLI_STATE_DIR env var (legacy, resolved to <dir>/state.json) >
 * default (~/.jahia-cli/state.json).
 */
export const stateFilePath = (statePath?: string): string => {
  const legacyStateDir = process.env['JAHIA_CLI_STATE_DIR'];
  const legacyStatePath = legacyStateDir ? join(legacyStateDir, 'state.json') : undefined;
  return statePath ?? process.env['JAHIA_CLI_STATE'] ?? legacyStatePath ?? join(homedir(), '.jahia-cli', 'state.json');
};
