/**
 * Selection rule for a service group.
 */
export type SelectionRule = 'always_included' | 'at_most_one' | 'zero_or_more';

/**
 * Configuration for a single service group from config.yml.
 */
export interface ServiceGroupConfig {
  readonly label: string;
  readonly description: string;
  readonly selection: SelectionRule;
  readonly order: number;
}

/**
 * Parsed config.yml structure — defines all groups.
 */
export interface ServicesConfig {
  readonly groups: Readonly<Record<string, ServiceGroupConfig>>;
}

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
  readonly group: string;
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
