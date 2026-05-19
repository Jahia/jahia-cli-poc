import { resolveEnvVars, resolveEnvVarsInRecord } from './resolve-env-vars.js';

/**
 * Resolves environment variable substitution in component overrides.
 * Applies `${VAR}` and `${VAR:-default}` resolution to `image`, `tag`,
 * and `env` values — the same env vars available in workflow `run:` steps.
 */
export const resolveComponentOverrides = (
  rawOverrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...rawOverrides };

  if (typeof result['image'] === 'string') {
    result['image'] = resolveEnvVars(result['image']);
  }

  if (typeof result['tag'] === 'string') {
    result['tag'] = resolveEnvVars(result['tag']);
  }

  if (typeof result['alias'] === 'string') {
    const alias = resolveEnvVars(result['alias']).trim();
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(alias)) {
      throw new Error(
        `Invalid alias "${alias}": must be a valid hostname (lowercase alphanumeric and hyphens, no leading/trailing hyphens).`,
      );
    }
    result['alias'] = alias;
  }

  if (
    result['env'] !== undefined &&
    typeof result['env'] === 'object' &&
    result['env'] !== null &&
    !Array.isArray(result['env'])
  ) {
    result['env'] = resolveEnvVarsInRecord(result['env'] as Record<string, string>);
  }

  if (Array.isArray(result['artifacts'])) {
    result['artifacts'] = (result['artifacts'] as readonly unknown[]).map(
      (entry, index) => {
        if (
          typeof entry !== 'object' || entry === null ||
          typeof (entry as Record<string, unknown>)['source'] !== 'string' ||
          typeof (entry as Record<string, unknown>)['destination'] !== 'string'
        ) {
          throw new Error(
            `Artifact at index ${String(index)} must have string "source" and "destination" fields.`,
          );
        }
        const obj = entry as Record<string, unknown>;
        return { source: obj['source'] as string, destination: obj['destination'] as string };
      },
    );
  }

  return result;
};
