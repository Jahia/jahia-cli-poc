import type { JcliEnvEntry } from './types.js';

/**
 * Collects all JCLI_-prefixed environment variables from the given env object,
 * sorted alphabetically by key. Marks JCLI_SECRET_* entries as secrets.
 */
export const collectJcliVars = (
  env: Readonly<Record<string, string | undefined>>,
): readonly JcliEnvEntry[] =>
  Object.entries(env)
    .filter((entry): entry is [string, string] =>
      entry[0].startsWith('JCLI_') && entry[1] !== undefined,
    )
    .map(([key, value]) => ({
      key,
      value,
      isSecret: key.startsWith('JCLI_SECRET_'),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
