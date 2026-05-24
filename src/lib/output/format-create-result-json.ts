import type { CreateResult } from '../providers/types.js';

/**
 * Formats a create result as structured JSON for AI agent consumption.
 * Includes stateFile path when provided.
 */
export const formatCreateResultJson = (result: CreateResult, stateFile?: string  ): string =>
  JSON.stringify(
    {
      status: result.success ? 'success' : 'error',
      environment: result.environment,
      errors: result.errors,
      ...(stateFile !== undefined ? { stateFile } : {}),
    },
    null,
    2,
  );
