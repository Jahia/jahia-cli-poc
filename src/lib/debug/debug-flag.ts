import { Flags } from '@oclif/core';

/**
 * Shared OCLIF flag definition for --debug.
 * Spread into any command's static flags to enable debug env var display.
 * Can also be activated via JCLI_DEBUG=true environment variable.
 */
export const debugFlag = Flags.boolean({
  description:
    'Display JCLI_* environment variables at start for debugging. ' +
    'Can also be enabled via JCLI_DEBUG=true environment variable.',
  env: 'JCLI_DEBUG',
  default: false,
});
