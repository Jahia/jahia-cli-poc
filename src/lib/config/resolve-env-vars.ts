/**
 * Environment variable substitution for config values.
 *
 * Supports two patterns:
 *   - `${VAR}` — resolves to the value of VAR; throws if VAR is not set
 *   - `${VAR:-default}` — resolves to VAR if set, otherwise uses the default value
 *
 * This is consistent with bash variable expansion and with how the workflow
 * engine passes environment variables to `run:` steps via `process.env`.
 * All env vars come from the same source: the shell session's environment.
 *
 * Bare `$` characters and malformed patterns are left as-is.
 */

/**
 * Regex matching `${VAR}` and `${VAR:-default}` patterns.
 * Captures:
 *   [1] = variable name (letters, digits, underscores)
 *   [2] = default value (everything after `:-`, may be empty string)
 */
const ENV_VAR_PATTERN = /\$\{([A-Za-z_]\w*)(?::-(.*?))?\}/g;

/**
 * Resolves `${VAR}` and `${VAR:-default}` patterns in a string
 * using `process.env`.
 *
 * - `${VAR}` with no default throws if VAR is not defined in the environment.
 * - `${VAR:-default}` falls back to `default` when VAR is not defined.
 * - Patterns are resolved in a single pass (no nested resolution).
 * - Bare `$` characters and malformed patterns are left unchanged.
 */
export const resolveEnvVars = (value: string): string =>
  value.replace(ENV_VAR_PATTERN, (match, varName: string, defaultValue: string | undefined) => {
    const envValue = process.env[varName];

    if (envValue !== undefined) {
      return envValue;
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw new Error(
      `Environment variable "${varName}" is not set and no default was provided. ` +
      `Use \${${varName}:-default_value} to provide a fallback, ` +
      `or set the variable in your shell: export ${varName}=value`,
    );
  });

/**
 * Applies `resolveEnvVars` to every value in a string record.
 * Returns a new record with all values resolved.
 */
export const resolveEnvVarsInRecord = (
  record: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, resolveEnvVars(value)]),
  );
