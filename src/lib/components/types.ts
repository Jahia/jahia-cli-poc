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
 * Maps a container path to a destination in the output folder during artifact collection.
 * `source` is the absolute path inside the container.
 * `destination` is the relative path under the output directory (use './' for output root).
 */
export interface ArtifactMapping {
  readonly source: string;
  readonly destination: string;
}

/**
 * Component categories for organizing the registry.
 */
export type ComponentCategory =
  | 'core'
  | 'infrastructure'
  | 'database'
  | 'search'
  | 'application'
  | 'utility'
  | 'custom';

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
  readonly category: ComponentCategory;
  readonly isTransparent: boolean;
  readonly multiInstance: boolean;
  readonly providerSupport: readonly ('docker' | 'jahiacloudv1')[];
  readonly args?: readonly string[] | undefined;
  /**
   * Environment variables to inject into other components when this component is present.
   * Keys are target component names, values are env var maps to merge into those components.
   */
  readonly envInjections?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined;
  /**
   * Container paths to collect as test artifacts (logs, diagnostic files, directories).
   * Each entry maps a container path to a relative destination in the output folder.
   * Example: [{ source: '/var/log/jahia', destination: 'jahia/' }]
   */
  readonly artifacts?: readonly ArtifactMapping[] | undefined;
}

/**
 * User-provided overrides for a component.
 * Only the fields that differ from defaults need to be specified.
 *
 * The `image` field accepts the full Docker reference including tag
 * (e.g. "jahia/jahia-ee:8.3.0.0" or "my-registry.example.com/jahia/jahia-ee:8.3.0.0").
 * When `image` contains a tag, that tag is used unless a separate `tag` override
 * is also provided — the explicit `tag` override always takes precedence.
 *
 * Both `image` and `tag` support environment variable substitution:
 *   - `${VAR}` — resolves from process.env; errors if not set
 *   - `${VAR:-default}` — resolves from process.env with a fallback
 *
 * Example:
 *   image: "${JAHIA_IMAGE:-jahia/jahia-ee:8.2.1.0}"
 */
export interface ComponentOverrides {
  readonly image?: string | undefined;
  readonly tag?: string | undefined;
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly ports?: readonly PortMapping[] | undefined;
  /**
   * Custom network alias for this component inside the Docker network.
   * The alias is **prepended** to the default aliases from the component
   * definition, so existing consumers that address the component by its
   * built-in alias (e.g., "jahia") still work.
   *
   * Must be a valid hostname: lowercase alphanumeric, hyphens allowed,
   * no leading/trailing hyphens.
   *
   * Example:
   *   alias: my-jahia   # container reachable as both "my-jahia" and "jahia"
   */
  readonly alias?: string | undefined;
  /**
   * Additional artifact mappings to collect as test artifacts.
   * These are merged with the component definition's artifacts during resolution.
   * Entries with the same `source` path as definition artifacts override the destination.
   */
  readonly artifacts?: readonly ArtifactMapping[] | undefined;
}

/**
 * A component with its overrides applied, ready for deployment.
 */
export interface ResolvedComponent {
  readonly definition: ComponentDefinition;
  readonly overrides: ComponentOverrides;
  readonly effectiveImage: string;
  readonly effectiveTag: string;
  readonly effectiveEnv: Readonly<Record<string, string>>;
  readonly effectivePorts: readonly PortMapping[];
  readonly effectiveArtifacts: readonly ArtifactMapping[];
  /** Network aliases for Docker networking. Includes any user-provided alias
   *  prepended to the component definition's built-in aliases. */
  readonly effectiveNetworkAliases: readonly string[];
}
