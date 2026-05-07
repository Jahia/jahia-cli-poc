import {
  DEFAULT_PROVIDER,
  DEFAULT_SCAFFOLDING_PATH,
  DEFAULT_SCAFFOLDING_REPOSITORY,
  DEFAULT_SCAFFOLDING_VERSION,
  generateEnvName,
} from './defaults.js';
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
  tests: {
    scaffolding: {
      repository: DEFAULT_SCAFFOLDING_REPOSITORY,
      path: DEFAULT_SCAFFOLDING_PATH,
      version: DEFAULT_SCAFFOLDING_VERSION,
    },
  },
});
