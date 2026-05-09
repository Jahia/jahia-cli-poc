import type { ComponentCategory, ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
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
 * Resolves a component by merging its definition with user-provided overrides.
 */
export const resolveComponent = (
  definition: ComponentDefinition,
  overrides: ComponentOverrides = {},
): ResolvedComponent => ({
  definition,
  overrides,
  effectiveTag: overrides.tag ?? definition.defaultTag,
  effectiveEnv: { ...definition.env, ...overrides.env },
  effectivePorts: overrides.ports ?? definition.ports,
});

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
      effectiveEnv: { ...c.effectiveEnv, ...extra },
    };
  });
};

export type { ComponentCategory, ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
