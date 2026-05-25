import type {
  ComponentStatus,
  CreateResult,
  DestroyResult,
  EnvironmentState,
  HealthCheckResult,
  Provider,
  StartResult,
  StopResult,
} from '../types.js';
import { runCompose, runComposeStreaming } from './run-compose.js';
import { parseComposePsOutput } from './parse-compose-ps.js';

/**
 * Docker Compose provider implementation.
 * Manages environments by delegating to `docker compose` CLI commands.
 */
export const dockerComposeProvider: Provider = {
  name: 'docker',

  createEnvironment: async (
    envName: string,
    composePath: string,
    onProgress?: (message: string) => void,
  ): Promise<CreateResult> => {
    try {
      onProgress?.(`Starting environment "${envName}" with docker compose...`);
      onProgress?.('  Pulling images (this may take a few minutes on first run)...');

      await runComposeStreaming({
        composePath,
        args: ['up', '-d', '--wait'],
        onOutput: (line) => {
          // Surface meaningful progress lines to the user
          if (line.includes('Pull') || line.includes('pull')) {
            onProgress?.(`  ${line.trim()}`);
          } else if (line.includes('Started') || line.includes('Running') || line.includes('Healthy')) {
            onProgress?.(`  ${line.trim()}`);
          } else if (line.includes('Creating') || line.includes('Created')) {
            onProgress?.(`  ${line.trim()}`);
          }
        },
      });
      onProgress?.('All services started.');

      const { stdout } = await runCompose({ composePath, args: ['ps', '--format', 'json'] });
      const components = parseComposePsOutput(stdout);

      return {
        success: true,
        environment: {
          name: envName,
          provider: 'docker',
          components,
          createdAt: new Date().toISOString(),
        },
        errors: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        environment: { name: envName, provider: 'docker', components: [] },
        errors: [`Failed to create environment: ${msg}`],
      };
    }
  },

  stopEnvironment: async (envName: string, composePath: string): Promise<StopResult> => {
    try {
      const { stdout: psBefore } = await runCompose({ composePath, args: ['ps', '--format', 'json'] });
      const componentsBefore = parseComposePsOutput(psBefore);

      await runCompose({ composePath, args: ['stop'] });

      return {
        success: true,
        stoppedComponents: componentsBefore.map((c) => c.name),
        errors: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stoppedComponents: [],
        errors: [`Failed to stop environment: ${msg}`],
      };
    }
  },

  startEnvironment: async (envName: string, composePath: string): Promise<StartResult> => {
    try {
      await runCompose({ composePath, args: ['start'] });

      const { stdout } = await runCompose({ composePath, args: ['ps', '--format', 'json'] });
      const components = parseComposePsOutput(stdout);

      return {
        success: true,
        startedComponents: components.map((c) => c.name),
        errors: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        startedComponents: [],
        errors: [`Failed to start environment: ${msg}`],
      };
    }
  },

  destroyEnvironment: async (envName: string, composePath: string): Promise<DestroyResult> => {
    try {
      const { stdout: psBefore } = await runCompose({ composePath, args: ['ps', '-a', '--format', 'json'] });
      const componentsBefore = parseComposePsOutput(psBefore);

      await runCompose({ composePath, args: ['down', '-v', '--remove-orphans'] });

      return {
        success: true,
        removedComponents: componentsBefore.map((c) => c.name),
        removedVolumes: [],
        errors: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        removedComponents: [],
        removedVolumes: [],
        errors: [`Failed to destroy environment: ${msg}`],
      };
    }
  },

  getEnvironmentStatus: async (envName: string, composePath: string): Promise<EnvironmentState> => {
    try {
      const { stdout } = await runCompose({ composePath, args: ['ps', '--format', 'json'] });
      const components = parseComposePsOutput(stdout);

      return {
        name: envName,
        provider: 'docker',
        components,
      };
    } catch {
      return {
        name: envName,
        provider: 'docker',
        components: [],
      };
    }
  },

  checkHealth: async (envName: string, composePath: string): Promise<HealthCheckResult> => {
    const state = await dockerComposeProvider.getEnvironmentStatus(envName, composePath);

    const checks = state.components.map((comp: ComponentStatus) => ({
      name: comp.name,
      passed: comp.status === 'running' && (comp.health === 'healthy' || comp.health === 'none'),
      message:
        comp.status === 'not_found'
          ? 'Container not found'
          : comp.status === 'stopped'
            ? 'Container is stopped'
            : comp.health === 'healthy' || comp.health === 'none'
              ? 'Healthy'
              : comp.health === 'starting'
                ? 'Starting (healthcheck pending)'
                : `Health status: ${comp.health ?? 'unknown'}`,
    }));

    return {
      success: checks.every((c) => c.passed),
      environment: state,
      checks,
    };
  },
};
