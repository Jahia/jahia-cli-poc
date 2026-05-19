import { parseScaffoldingConfig } from './parse-scaffolding-config.js';
import { parseTestContainerConfig } from './parse-test-container-config.js';
import type { TestsConfig } from './types.js';

/**
 * Parses and validates the optional tests section.
 */
export const parseTestsConfig = (rawTests: unknown): TestsConfig | undefined => {
  if (rawTests === undefined) {
    return undefined;
  }

  if (typeof rawTests !== 'object' || rawTests === null || Array.isArray(rawTests)) {
    throw new Error('Configuration "tests" field must be an object when provided.');
  }

  const testsRecord = rawTests as Record<string, unknown>;
  const jahiaCypress = testsRecord['jahia-cypress'];

  if (jahiaCypress !== undefined && typeof jahiaCypress !== 'string') {
    throw new Error('Configuration "tests.jahia-cypress" must be a string when provided.');
  }

  const scaffolding =
    testsRecord['scaffolding'] !== undefined
      ? parseScaffoldingConfig(testsRecord['scaffolding'])
      : undefined;

  const container = parseTestContainerConfig(testsRecord['container']);

  return {
    ...(jahiaCypress === undefined ? {} : { 'jahia-cypress': jahiaCypress }),
    ...(scaffolding === undefined ? {} : { scaffolding }),
    ...(container === undefined ? {} : { container }),
  };
};
