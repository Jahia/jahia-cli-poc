/**
 * Defines a port mapping from container port to host port.
 */
export interface PortMapping {
  readonly container: number;
  readonly host: number;
  readonly protocol?: 'tcp' | 'udp' | undefined;
}

/**
 * Defines a named volume mount.
 */
export interface VolumeMount {
  readonly name: string;
  readonly containerPath: string;
}

/**
 * Defines a container healthcheck configuration.
 */
export interface HealthcheckConfig {
  readonly command: readonly string[];
  readonly intervalSeconds: number;
  readonly timeoutSeconds: number;
  readonly retries: number;
  readonly startPeriodSeconds: number;
}

/**
 * Full definition of a component in the library.
 * Contains all the information needed to start and manage a container.
 */
export interface ComponentDefinition {
  readonly name: string;
  readonly description: string;
  readonly image: string;
  readonly defaultTag: string;
  readonly ports: readonly PortMapping[];
  readonly env: Readonly<Record<string, string>>;
  readonly volumes: readonly VolumeMount[];
  readonly healthcheck?: HealthcheckConfig | undefined;
  readonly dependsOn: readonly string[];
  readonly networkAliases: readonly string[];
}

/**
 * User-provided overrides for a component.
 * Only the fields that differ from defaults need to be specified.
 */
export interface ComponentOverrides {
  readonly tag?: string | undefined;
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly ports?: readonly PortMapping[] | undefined;
}

/**
 * A component with its overrides applied, ready for deployment.
 */
export interface ResolvedComponent {
  readonly definition: ComponentDefinition;
  readonly overrides: ComponentOverrides;
  readonly effectiveTag: string;
  readonly effectiveEnv: Readonly<Record<string, string>>;
  readonly effectivePorts: readonly PortMapping[];
}
