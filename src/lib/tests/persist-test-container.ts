import { inspectContainer } from '../providers/docker/container.js';
import { loadState } from '../state/load-state.js';
import { saveState } from '../state/save-state.js';
import type { PersistedComponent } from '../state/types.js';

/**
 * Persists the test container into the environment state file.
 * Upserts by component name — replaces any existing entry with the same name.
 * Uses `docker inspect` to resolve the real container ID.
 */
export const persistTestContainer = async (
  statePath: string,
  name: string,
  image: string,
  tag: string,
  networkAliases: readonly string[],
  ports: readonly { readonly container: number; readonly host: number }[],
): Promise<void> => {
  const state = await loadState(statePath);
  if (state?.environment === undefined) {
    return;
  }

  const inspection = await inspectContainer(name);
  const containerId = inspection?.id ?? name;

  const entry: PersistedComponent = {
    name: 'cypress',
    image,
    tag,
    containerId,
    endpoints: {
      aliases: [...networkAliases],
      ports: ports.map((p) => ({ container: p.container, host: p.host })),
    },
  };

  // Upsert: replace existing cypress entry or append
  const existingIndex = state.environment.components.findIndex((c) => c.name === 'cypress');
  const updatedComponents = existingIndex >= 0
    ? state.environment.components.map((c, i) => (i === existingIndex ? entry : c))
    : [...state.environment.components, entry];

  await saveState({
    ...state,
    environment: {
      ...state.environment,
      components: updatedComponents,
    },
  }, statePath);
};
