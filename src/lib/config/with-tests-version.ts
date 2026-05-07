import type { JahiaCliConfig } from './types.js';

/**
 * Returns a config enriched with the jahia-cypress tests version metadata.
 */
export const withTestsVersion = (config: JahiaCliConfig, version: string): JahiaCliConfig => ({
  ...config,
  tests: {
    ...(config.tests ?? {}),
    'jahia-cypress': version,
  },
});
