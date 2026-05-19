import type { HealthCheckResult } from '../providers/types.js';

/**
 * Formats a health check result as structured JSON for AI agent consumption.
 * Includes stateFile path when provided.
 */
export const formatHealthCheckJson = (result: HealthCheckResult, stateFile?: string): string =>
  JSON.stringify(
    {
      status: result.success ? 'healthy' : 'unhealthy',
      environment: result.environment,
      checks: result.checks,
      ...(stateFile !== undefined ? { stateFile } : {}),
    },
    null,
    2,
  );
