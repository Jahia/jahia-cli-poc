import type { PortMapping, ResolvedComponent } from '../components/types.js';

/**
 * Status of an individual component within an environment.
 */
export interface ComponentStatus {
  readonly name: string;
  readonly status: 'running' | 'stopped' | 'unhealthy' | 'not_found' | 'starting';
  readonly containerId?: string | undefined;
  readonly ports?: Readonly<Record<string, number>> | undefined;
  readonly health?: 'healthy' | 'unhealthy' | 'starting' | 'none' | undefined;
  readonly image?: string | undefined;
  readonly tag?: string | undefined;
  readonly category?: string | undefined;
  /** Network aliases and port mappings for endpoint visibility. */
  readonly endpoints?: {
    readonly aliases: readonly string[];
    readonly ports: readonly PortMapping[];
  } | undefined;
}

/**
 * Full state of a deployed environment.
 */
export interface EnvironmentState {
  readonly name: string;
  readonly provider: string;
  readonly network: string;
  readonly components: readonly ComponentStatus[];
  readonly createdAt?: string | undefined;
}

/**
 * Result of an environment creation operation.
 */
export interface CreateResult {
  readonly success: boolean;
  readonly environment: EnvironmentState;
  readonly errors: readonly string[];
}

/**
 * Result of an environment stop operation.
 */
export interface StopResult {
  readonly success: boolean;
  readonly stoppedComponents: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Result of an environment start operation.
 */
export interface StartResult {
  readonly success: boolean;
  readonly startedComponents: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Result of an environment destroy operation.
 */
export interface DestroyResult {
  readonly success: boolean;
  readonly removedComponents: readonly string[];
  readonly removedNetwork: boolean;
  readonly removedVolumes: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Result of a health check operation.
 */
export interface HealthCheckResult {
  readonly success: boolean;
  readonly environment: EnvironmentState;
  readonly checks: readonly {
    readonly name: string;
    readonly passed: boolean;
    readonly message: string;
  }[];
}

/**
 * Provider interface — implemented by each deployment backend.
 * All methods return Promises to support async operations (Docker CLI, HTTP APIs).
 */
export interface Provider {
  readonly name: string;
  readonly createEnvironment: (
    envName: string,
    components: readonly ResolvedComponent[],
    onProgress?: (message: string) => void,
  ) => Promise<CreateResult>;
  readonly stopEnvironment: (envName: string) => Promise<StopResult>;
  readonly startEnvironment: (envName: string) => Promise<StartResult>;
  readonly destroyEnvironment: (envName: string) => Promise<DestroyResult>;
  readonly getEnvironmentStatus: (envName: string) => Promise<EnvironmentState>;
  readonly checkHealth: (envName: string) => Promise<HealthCheckResult>;
}
