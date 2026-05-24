import type { JcliEnvEntry } from './types.js';
import { maskSecretValue } from './mask-secret-value.js';
import { truncateLongValue } from './truncate-long-value.js';

/**
 * Formats collected JCLI environment variable entries as indented, aligned key=value lines.
 * Returns a "none detected" message when the list is empty.
 * Secret values are masked. Non-secret values exceeding 200 characters are truncated.
 */
export const formatDebugVarsHuman = (entries: readonly JcliEnvEntry[]): string => {
  if (entries.length === 0) {
    return '  No JCLI_* environment variables detected.';
  }

  const maxKeyLength = Math.max(...entries.map((e) => e.key.length));

  const lines = entries.map((entry) => {
    const paddedKey = entry.key.padEnd(maxKeyLength);
    const displayValue = entry.isSecret
      ? maskSecretValue(entry.value)
      : truncateLongValue(entry.value);
    return `  ${paddedKey} = ${displayValue}`;
  });

  return [
    ...lines,
    '',
    `  (${String(entries.length)} variable${entries.length === 1 ? '' : 's'} detected)`,
  ].join('\n');
};
