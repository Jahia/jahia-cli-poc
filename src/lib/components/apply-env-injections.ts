import type { ResolvedComponent } from './types.js';
import { resolveEnvVarsInRecord } from '../config/resolve-env-vars.js';

/**
 * Applies envInjections from all selected components to their target components.
 * Returns a new array of ResolvedComponents with injected env vars merged in.
 * Dependencies are an implementation detail — callers just pass all selected components.
 */
export const applyEnvInjections = (
  components: readonly ResolvedComponent[],
): readonly ResolvedComponent[] => {
  const injections = new Map<string, Record<string, string>>();

  // Collect all injections from selected components
  components.forEach((c) => {
    const envInjections = c.definition.envInjections;
    if (envInjections === undefined) return;
    Object.entries(envInjections).forEach(([targetName, vars]) => {
      const existing = injections.get(targetName) ?? {};
      injections.set(targetName, { ...existing, ...vars });
    });
  });

  // Apply injections to target components
  return components.map((c) => {
    const extra = injections.get(c.definition.name);
    if (extra === undefined) return c;
    return {
      ...c,
      effectiveEnv: resolveEnvVarsInRecord({ ...c.effectiveEnv, ...extra }),
    };
  });
};
