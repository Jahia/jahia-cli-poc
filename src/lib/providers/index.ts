import type { Provider } from './types.js';
import { dockerProvider } from './docker/index.js';
import { jahiaCloudV1Provider } from './jahiacloudv1/index.js';

export type ProviderName = 'docker' | 'jahiacloudv1';

const PROVIDER_REGISTRY: Readonly<Record<ProviderName, Provider>> = {
  docker: dockerProvider,
  jahiacloudv1: jahiaCloudV1Provider,
};

/**
 * Returns a provider by name.
 * Throws if the provider name is not recognized.
 */
export const getProvider = (name: string): Provider => {
  const provider = (PROVIDER_REGISTRY as Readonly<Record<string, Provider | undefined>>)[name];
  if (!provider) {
    throw new Error(
      `Unknown provider "${name}". Available providers: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`,
    );
  }
  return provider;
};

/**
 * Returns all available provider names.
 */
export const listProviderNames = (): readonly string[] => Object.keys(PROVIDER_REGISTRY);

export type { Provider, CreateResult, EnvironmentState, HealthCheckResult, ComponentStatus } from './types.js';
