import { randomBytes } from 'node:crypto';

/**
 * Generates a default environment name using a short random suffix.
 */
export const generateEnvName = (): string => {
  const suffix = randomBytes(4).toString('hex');
  return `env-${suffix}`;
};

/**
 * Default provider when none is specified.
 */
export const DEFAULT_PROVIDER = 'docker';
