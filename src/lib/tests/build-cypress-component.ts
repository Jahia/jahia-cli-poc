import { applyEnvInjections, getComponent, resolveComponent } from '../components/index.js';
import type { ResolvedComponent } from '../components/types.js';
import type { TestContainerConfig } from '../config/types.js';
import { DEFAULT_IMAGE_NAME } from './build-image.js';

/**
 * Builds a ResolvedComponent for the cypress test runner using the component registry.
 * Reads image/tag from tests.container config and applies env injections from sibling components.
 */
export const buildCypressComponent = (
  envComponents: readonly string[],
  containerConfig: TestContainerConfig | undefined,
  scaffoldingVersion: string | undefined,
  extraEnv: Readonly<Record<string, string>>,
): ResolvedComponent => {
  const definition = getComponent('cypress');
  if (definition === undefined) {
    throw new Error('cypress component not found in registry');
  }

  const imageOverride = containerConfig?.image ?? DEFAULT_IMAGE_NAME;
  const tagOverride = containerConfig?.tag ?? scaffoldingVersion ?? 'latest';

  const resolved = resolveComponent(definition, {
    image: `${imageOverride}:${tagOverride}`,
    env: extraEnv,
  });

  // Build sibling components (from persisted env) to apply envInjections
  const siblings: readonly ResolvedComponent[] = envComponents
    .map((name) => {
      const def = getComponent(name);
      return def !== undefined ? resolveComponent(def) : undefined;
    })
    .filter((c): c is ResolvedComponent => c !== undefined);

  const allComponents = [...siblings, resolved];
  const injected = applyEnvInjections(allComponents);

  // Return the cypress component with injections applied
  const cypressResult = injected[injected.length - 1];
  if (cypressResult === undefined) {
    throw new Error('Failed to resolve cypress component after env injection');
  }

  return cypressResult;
};
