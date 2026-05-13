import type { ComponentCategory, ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
import { resolveEnvVarsInRecord } from '../config/resolve-env-vars.js';
import { jahia } from './jahia.js';
import { smtpServer } from './smtp-server.js';
import { victorialogs } from './victorialogs.js';

/**
 * Registry of all available components.
 * To add a new component: create a file, define the ComponentDefinition, import and add here.
 */
export const COMPONENT_REGISTRY: Readonly<Record<string, ComponentDefinition>> = {
  jahia,
  'smtp-server': smtpServer,
  victorialogs,
};

/**
 * Returns all registered component names.
 */
export const listComponentNames = (): readonly string[] => Object.keys(COMPONENT_REGISTRY);

/**
 * Returns all registered component definitions.
 */
export const listComponents = (): readonly ComponentDefinition[] =>
  Object.values(COMPONENT_REGISTRY);

/**
 * Returns components that are user-selectable (not transparent infrastructure).
 */
export const listUserSelectableComponents = (): readonly ComponentDefinition[] =>
  Object.values(COMPONENT_REGISTRY).filter((c) => !c.isTransparent);

/**
 * Returns transparent infrastructure components (auto-deployed).
 */
export const listTransparentComponents = (): readonly ComponentDefinition[] =>
  Object.values(COMPONENT_REGISTRY).filter((c) => c.isTransparent);

/**
 * Returns components matching a specific category.
 */
export const listComponentsByCategory = (category: ComponentCategory): readonly ComponentDefinition[] =>
  Object.values(COMPONENT_REGISTRY).filter((c) => c.category === category);

/**
 * Retrieves a component definition by name.
 * Returns undefined if the component is not found.
 */
export const getComponent = (name: string): ComponentDefinition | undefined =>
  COMPONENT_REGISTRY[name];

/**
 * Parses a Docker image reference that may include a tag (e.g. "jahia/jahia-ee:8.3.0.0").
 * Returns the image name and optional embedded tag separately.
 */
export const parseImageReference = (
  ref: string,
): { readonly image: string; readonly tag: string | undefined } => {
  // A colon after a slash-separated path segment indicates a tag.
  // We split on the *last* colon that isn't part of a registry port (registry:port/repo).
  // Simple heuristic: if the part after the last colon contains '/' it's not a tag.
  const lastColon = ref.lastIndexOf(':');
  if (lastColon === -1) {
    return { image: ref, tag: undefined };
  }

  const afterColon = ref.slice(lastColon + 1);
  // If afterColon contains '/' it's likely a registry:port/repo pattern, not a tag
  if (afterColon.includes('/')) {
    return { image: ref, tag: undefined };
  }

  return { image: ref.slice(0, lastColon), tag: afterColon };
};

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
  };
};

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

export type { ComponentCategory, ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
