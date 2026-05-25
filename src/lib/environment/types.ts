/**
 * A dependency declared in a service's x-metadata.requires field.
 */
export interface ServiceDependency {
  readonly service?: string | undefined;
  readonly group?: string | undefined;
}

/**
 * Parsed x-metadata from a service YAML file.
 */
export interface ServiceMetadata {
  readonly name: string;
  readonly description: string;
  readonly group?: string | undefined;
  readonly optional?: boolean | undefined;
  readonly requires: readonly ServiceDependency[];
  readonly notes?: string | undefined;
}

/**
 * A service discovered from the services/ directory.
 */
export interface DiscoveredService {
  readonly filename: string;
  readonly metadata: ServiceMetadata;
}

/**
 * A service selected by the user during init.
 */
export interface ServiceSelection {
  readonly filename: string;
  readonly metadata: ServiceMetadata;
}

/**
 * Result of cloning the environment scaffolding.
 */
export interface EnvironmentScaffoldingResult {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly checkoutDir: string;
  readonly environmentDir: string;
  readonly servicesDir: string;
}
