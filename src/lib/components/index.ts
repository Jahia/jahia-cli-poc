import type { ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
import { jahia } from './jahia.js';
import { jahiaBrowsing } from './jahia-browsing.js';
import { pgsql } from './pgsql.js';
import { elasticsearch } from './elasticsearch.js';

/**
 * Registry of all available components.
 * To add a new component: create a file, define the ComponentDefinition, import and add here.
 */
export const COMPONENT_REGISTRY: Readonly<Record<string, ComponentDefinition>> = {
  jahia,
  'jahia-browsing': jahiaBrowsing,
  pgsql,
  elasticsearch,
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

export type { ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
