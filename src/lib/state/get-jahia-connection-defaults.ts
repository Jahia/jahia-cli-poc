import type { PersistedEnvironment } from './types.js';
import { COMPONENT_REGISTRY } from '../components/index.js';
import { resolveEnvVars } from '../config/resolve-env-vars.js';

/**
 * Connection details for a Jahia instance, derived from environment state.
 */
export interface JahiaConnectionDefaults {
  readonly url: string;
  readonly username: string;
  readonly password: string;
}

const DEFAULT_URL = 'http://localhost:8080';
const DEFAULT_USERNAME = 'root';
const DEFAULT_PASSWORD = 'root1234';

/**
 * Extracts Jahia connection defaults from the persisted environment state.
 * Looks for a 'jahia' component to determine the host port and password.
 * Falls back to hardcoded defaults when state is unavailable or incomplete.
 */
export const getJahiaConnectionDefaults = (
  env: PersistedEnvironment | undefined,
): JahiaConnectionDefaults => {
  if (env === undefined) {
    return { url: DEFAULT_URL, username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD };
  }

  const jahiaConfig = env.config.components.find((c) => c.name === 'jahia');
  const jahiaDef = COMPONENT_REGISTRY['jahia'];

  // Resolve the host port: override → definition default → 8080
  const portMapping = jahiaConfig?.overrides?.ports?.[0] ?? jahiaDef?.ports[0];
  const port = portMapping?.host ?? 8080;
  const url = `http://localhost:${String(port)}`;

  // Resolve password: override env → definition env (with env var resolution) → default
  const rawPassword =
    jahiaConfig?.overrides?.env?.['SUPER_USER_PASSWORD'] ??
    jahiaDef?.env['SUPER_USER_PASSWORD'] ??
    DEFAULT_PASSWORD;
  const password = resolveEnvVars(rawPassword);

  return { url, username: DEFAULT_USERNAME, password };
};
