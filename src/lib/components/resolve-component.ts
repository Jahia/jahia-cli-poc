import type { ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
import { resolveEnvVarsInRecord } from '../config/resolve-env-vars.js';
import { mergeArtifacts } from './merge-artifacts.js';
import { parseImageReference } from './parse-image-reference.js';

/**
 * Resolves a component by merging its definition with user-provided overrides.
 *
 * The `image` override accepts the full `image:tag` format (e.g. "jahia/jahia-ee:8.3.0.0").
 * When it contains a tag, that tag is used unless a separate `tag` override is also provided.
 *
 * Environment variables in both definition and override values support `${VAR}` and
 * `${VAR:-default}` substitution from `process.env`, consistent with the workflow engine.
 * This allows component definitions to reference host environment variables
 * (e.g. `JAHIA_LICENSE: '${JAHIA_LICENSE:-}'`) that are resolved at container creation time.
 */
export const resolveComponent = (
  definition: ComponentDefinition,
  overrides: ComponentOverrides = {},
): ResolvedComponent => {
  const parsed = overrides.image !== undefined
    ? parseImageReference(overrides.image)
    : undefined;

  const mergedEnv = { ...definition.env, ...overrides.env };

  return {
    definition,
    overrides,
    effectiveImage: parsed?.image ?? definition.image,
    effectiveTag: overrides.tag ?? parsed?.tag ?? definition.defaultTag,
    effectiveEnv: resolveEnvVarsInRecord(mergedEnv),
    effectivePorts: overrides.ports ?? definition.ports,
    effectiveArtifacts: mergeArtifacts(definition.artifacts ?? [], overrides.artifacts ?? []),
    effectiveNetworkAliases: overrides.alias
      ? [overrides.alias, ...definition.networkAliases]
      : definition.networkAliases,
  };
};
