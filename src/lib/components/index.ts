import type { ComponentCategory, ComponentDefinition } from './types.js';
import { cypress } from './cypress.js';
import { jahia } from './jahia.js';
import { smtpServer } from './smtp-server.js';
import { victorialogs } from './victorialogs.js';

/**
 * Registry of all available components.
 * To add a new component: create a file, define the ComponentDefinition, import and add here.
 */
export const COMPONENT_REGISTRY: Readonly<Record<string, ComponentDefinition>> = {
  cypress,
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

// Re-export complex functions from individual files
export { parseImageReference } from './parse-image-reference.js';
export { mergeArtifacts } from './merge-artifacts.js';
export { resolveComponent } from './resolve-component.js';
export { applyEnvInjections } from './apply-env-injections.js';

export type { ArtifactMapping, ComponentCategory, ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
