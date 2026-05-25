import type { JcliEnvEntry } from './types.js';
import { maskSecretValue } from './mask-secret-value.js';
import { truncateLongValue } from './truncate-long-value.js';

/**
 * Structured debug output for JSON mode.
 */
export interface DebugJsonOutput {
  readonly variables: readonly {
    readonly key: string;
    readonly value: string;
    readonly masked: boolean;
  }[];
  readonly count: number;
}

/**
 * Builds a JSON-serializable debug object from collected env entries.
 * Secret values are masked in the output.
 */
export const buildDebugJson = (entries: readonly JcliEnvEntry[]): DebugJsonOutput => ({
  variables: entries.map((entry) => ({
    key: entry.key,
    value: entry.isSecret ? maskSecretValue(entry.value) : truncateLongValue(entry.value),
    masked: entry.isSecret,
  })),
  count: entries.length,
});
