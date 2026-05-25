import { Flags } from '@oclif/core';

/**
 * Shared OCLIF flag definition for --debug.
 * Spread into any command's static flags to enable debug env var display.
 * Can also be activated via J_DEBUG=true environment variable.
 */
export const debugFlag = Flags.boolean({
  description:
    'Display environment variables matching the configured prefix at start for debugging. ' +
    'Can also be enabled via J_DEBUG=true environment variable.',
  env: 'J_DEBUG',
  default: false,
});
