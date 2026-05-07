import { DEFAULT_PROVIDER, generateEnvName } from './defaults.js';
import type { JahiaCliConfig } from './types.js';

/**
 * Builds a blank Jahia CLI configuration scaffold.
 */
export const buildBlankConfig = (): JahiaCliConfig => ({
  environment: {
    name: generateEnvName(),
    provider: DEFAULT_PROVIDER,
    components: [],
  },
});
