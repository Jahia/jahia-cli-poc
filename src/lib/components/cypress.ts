import type { ComponentDefinition } from './types.js';

/**
 * Cypress test runner component.
 *
 * This component runs Cypress end-to-end tests against a Jahia environment.
 * Unlike long-lived services, the test container runs to completion then exits.
 * The container is NOT auto-removed — it's kept for post-run debugging/inspection.
 *
 * The image is typically built locally via `tests build` and not pulled from a registry.
 * Override `image` in config to use a custom test image.
 *
 * Environment variables use in-network Docker aliases (e.g. `http://jahia:8080`)
 * since the test container shares the environment's Docker network.
 */
export const cypress: ComponentDefinition = {
  name: 'cypress',
  description: 'Cypress end-to-end test runner',
  image: 'jahia-tests',
  defaultTag: 'latest',
  ports: [],
  env: {
    JAHIA_URL: 'http://jahia:8080',
    SUPER_USER_PASSWORD: '${SUPER_USER_PASSWORD:-root1234}',
    NEXUS_USERNAME: '${NEXUS_USERNAME:-}',
    NEXUS_PASSWORD: '${NEXUS_PASSWORD:-}',
    MANIFEST: '${MANIFEST:-}',
  },
  volumes: [],
  dependsOn: ['jahia'],
  networkAliases: ['cypress'],
  category: 'application',
  isTransparent: false,
  multiInstance: false,
  providerSupport: ['docker'],
  artifacts: ['/home/jahians/results'],
};
