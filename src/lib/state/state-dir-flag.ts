import { Flags } from '@oclif/core';

/**
 * Shared OCLIF flag definition for --state-dir.
 * Spread into any command's static flags that reads or writes state.
 *
 * Priority order (handled by stateFilePath):
 *   1. --state-dir flag
 *   2. JAHIA_CLI_STATE_DIR env var
 *   3. ~/.jahia-cli/state.json (default)
 */
export const stateDirFlag = Flags.string({
  description:
    'Directory where the state file (state.json) is stored. ' +
    'Overrides JAHIA_CLI_STATE_DIR env var. ' +
    'Defaults to ~/.jahia-cli/',
  env: 'JAHIA_CLI_STATE_DIR',
});
