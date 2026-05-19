/**
 * Generates a container name scoped to an environment.
 */
export const containerName = (envName: string, componentName: string): string =>
  `jahia-cli-${envName}-${componentName}`;
