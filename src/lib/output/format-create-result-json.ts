import type { CreateResult } from '../providers/types.js';

/**
 * Formats a create result as structured JSON for AI agent consumption.
 * Includes stateFile path when provided.
 */
export const formatCreateResultJson = (result: CreateResult, stateFile?: string): string => {
  const endpoints = result.success
    ? Object.fromEntries(
        result.environment.components
          .filter((c) => c.endpoints && c.endpoints.ports.length > 0)
          .map((c) => {
            const ep = c.endpoints;
            const alias = ep?.aliases[0] ?? c.name;
            return [
              c.name,
              {
                aliases: ep?.aliases ?? [c.name],
                dockerNetwork: ep?.ports.map((p) => `${alias}:${String(p.container)}`) ?? [],
                host: ep?.ports.map((p) => `localhost:${String(p.host)}`) ?? [],
              },
            ];
          }),
      )
    : undefined;
  return JSON.stringify(
    {
      status: result.success ? 'success' : 'error',
      environment: result.environment,
      endpoints,
      errors: result.errors,
      ...(stateFile !== undefined ? { stateFile } : {}),
    },
    null,
    2,
  );
};
