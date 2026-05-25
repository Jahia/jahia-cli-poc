import type { JcliEnvEntry } from './types.js';

const SENSITIVE_KEYWORDS: readonly string[] = [
  'username',
  'password',
  'user',
  'token',
  'secret',
  'credential',
  'credentials',
  'apikey',
  'api_key',
  'passphrase',
  'private_key',
  'privatekey',
];

/**
 * Determines whether an environment variable name contains a sensitive keyword.
 * Matching is case-insensitive against the underscore-separated segments of the key.
 */
const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
};

/**
 * Collects all environment variables matching the given prefix from the env object,
 * sorted alphabetically by key. Marks entries as secrets when the variable name
 * contains a sensitive keyword (password, token, secret, etc.).
 */
export const collectJcliVars = (
  env: Readonly<Record<string, string | undefined>>,
  prefix = 'J_',
): readonly JcliEnvEntry[] =>
  Object.entries(env)
    .filter((entry): entry is [string, string] =>
      entry[0].startsWith(prefix) && entry[1] !== undefined,
    )
    .map(([key, value]) => ({
      key,
      value,
      isSecret: isSensitiveKey(key),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
