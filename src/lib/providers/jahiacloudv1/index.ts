import type { Provider } from '../types.js';

const notImplementedError = new Error(
  'The jahiacloudv1 provider is not yet implemented. ' +
    'Use the "docker" provider for local environments.',
);

/**
 * JahiaCloud v1 provider — placeholder implementation.
 * Will be implemented when the Jahia Cloud API integration is ready.
 */
export const jahiaCloudV1Provider: Provider = {
  name: 'jahiacloudv1',
  createEnvironment: () => Promise.reject(notImplementedError),
  stopEnvironment: () => Promise.reject(notImplementedError),
  startEnvironment: () => Promise.reject(notImplementedError),
  destroyEnvironment: () => Promise.reject(notImplementedError),
  getEnvironmentStatus: () => Promise.reject(notImplementedError),
  checkHealth: () => Promise.reject(notImplementedError),
};
