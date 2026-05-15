import type { PersistedEnvironment } from './types.js';
import type { NetworkMode, ResolvedUrl } from './resolve-url-types.js';
import { COMPONENT_REGISTRY } from '../components/index.js';
import { resolveEnvVars } from '../config/resolve-env-vars.js';
import { resolveComponentUrl } from './resolve-component-url.js';
import { detectDockerContext } from './detect-docker-context.js';

/**
 * Connection details for a Jahia instance, derived from environment state.
 * Backward-compatible interface — use `resolveJahiaConnection` for richer metadata.
 */
export interface JahiaConnectionDefaults {
  readonly url: string;
  readonly username: string;
  readonly password: string;
}

/**
 * Jahia connection with full provenance metadata for logging.
 */
export interface JahiaConnection {
  readonly url: string;
  readonly username: string;
  readonly password: string;
  readonly resolvedUrl: ResolvedUrl;
}

const DEFAULT_USERNAME = 'root';
const DEFAULT_PASSWORD = 'root1234';

/**
 * Resolves the Jahia password from config overrides, component definition, or default.
 */
export const resolveJahiaPassword = (env: PersistedEnvironment | undefined): string => {
  if (env === undefined) {
    return DEFAULT_PASSWORD;
  }

  const jahiaConfig = env.config.components.find((c) => c.name === 'jahia');
  const jahiaDef = COMPONENT_REGISTRY['jahia'];

  const rawPassword =
    jahiaConfig?.overrides?.env?.['SUPER_USER_PASSWORD'] ??
    jahiaDef?.env['SUPER_USER_PASSWORD'] ??
    DEFAULT_PASSWORD;
  return resolveEnvVars(rawPassword);
};

/**
 * Extracts Jahia connection defaults from the persisted environment state.
 * Backward-compatible wrapper — always resolves in 'host' mode.
 *
 * @deprecated Prefer `resolveJahiaConnection()` which is context-aware.
 */
export const getJahiaConnectionDefaults = (
  env: PersistedEnvironment | undefined,
): JahiaConnectionDefaults => {
  const resolved = resolveComponentUrl('jahia', env, 'host');
  const password = resolveJahiaPassword(env);
  return { url: resolved.url, username: DEFAULT_USERNAME, password };
};

/**
 * Resolves a full Jahia connection with automatic network mode detection.
 * Returns both the connection details and URL provenance metadata.
 *
 * When `urlFlag` is provided (user passed --url), it takes absolute priority
 * and the result source is `'flag'`.
 *
 * When `networkModeOverride` is provided, it skips auto-detection.
 */
export const resolveJahiaConnection = async (
  env: PersistedEnvironment | undefined,
  urlFlag?: string,
  networkModeOverride?: NetworkMode,
): Promise<JahiaConnection> => {
  const password = resolveJahiaPassword(env);

  // CLI flag takes absolute priority
  if (urlFlag !== undefined) {
    const networkMode = networkModeOverride ?? await detectDockerContext();
    return {
      url: urlFlag,
      username: DEFAULT_USERNAME,
      password,
      resolvedUrl: { url: urlFlag, source: 'flag', networkMode },
    };
  }

  const networkMode = networkModeOverride ?? await detectDockerContext();
  const resolved = resolveComponentUrl('jahia', env, networkMode);
  return {
    url: resolved.url,
    username: DEFAULT_USERNAME,
    password,
    resolvedUrl: resolved,
  };
};
