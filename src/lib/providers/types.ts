import type { ResolvedComponent } from '../components/types.js';

/**
 * Status of an individual component within an environment.
 */
export interface ComponentStatus {
  readonly name: string;
  readonly status: 'running' | 'stopped' | 'unhealthy' | 'not_found' | 'starting';
  readonly containerId?: string | undefined;
  readonly ports?: Readonly<Record<string, number>> | undefined;
  readonly health?: 'healthy' | 'unhealthy' | 'starting' | 'none' | undefined;
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
  ) => Promise<CreateResult>;
  readonly getEnvironmentStatus: (envName: string) => Promise<EnvironmentState>;
  readonly checkHealth: (envName: string) => Promise<HealthCheckResult>;
}
