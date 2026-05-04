import { Flags } from '@oclif/core';

/**
 * Shared OCLIF flag definition for --state.
 * Spread into any command's static flags that reads or writes state.
 */
export const stateFlag = Flags.string({
  description:
    'Path to the state JSON file. ' +
    'Overrides JAHIA_CLI_STATE env var. ' +
    'Defaults to ~/.jahia-cli/state.json',
  env: 'JAHIA_CLI_STATE',
});
