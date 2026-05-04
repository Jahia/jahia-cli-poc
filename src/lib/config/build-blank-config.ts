import { DEFAULT_PROVIDER, generateEnvName } from './defaults.js';
import type { EnvironmentConfig } from './types.js';

/**
 * Builds a blank Jahia CLI configuration scaffold.
 */
export const buildBlankConfig = (): EnvironmentConfig => ({
  name: generateEnvName(),
  provider: DEFAULT_PROVIDER,
  components: [],
});
