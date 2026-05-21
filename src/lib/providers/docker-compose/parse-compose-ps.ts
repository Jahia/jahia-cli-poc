import type { ComponentStatus } from '../types.js';

/**
 * Parses the NDJSON output from `docker compose ps --format json`.
 * Each line is a separate JSON object representing a container.
 */
export const parseComposePsOutput = (stdout: string): readonly ComponentStatus[] => {
  const lines = stdout.trim().split('\n').filter((line) => line.length > 0);

  return lines.map((line) => {
    const container = JSON.parse(line) as Record<string, unknown>;

    const name = typeof container['Service'] === 'string'
      ? container['Service']
      : typeof container['Name'] === 'string'
        ? container['Name']
        : 'unknown';

    const state = typeof container['State'] === 'string' ? container['State'] : '';
    const health = typeof container['Health'] === 'string' ? container['Health'] : '';

    const status: ComponentStatus['status'] =
      state === 'running' ? 'running'
      : state === 'exited' || state === 'dead' ? 'stopped'
      : state === 'created' ? 'starting'
      : 'not_found';

    const healthStatus: ComponentStatus['health'] =
      health === 'healthy' ? 'healthy'
      : health === 'unhealthy' ? 'unhealthy'
      : health === 'starting' ? 'starting'
      : 'none';

    return {
      name,
      status,
      health: healthStatus,
      containerId: typeof container['ID'] === 'string' ? container['ID'] : undefined,
    };
  });
};
