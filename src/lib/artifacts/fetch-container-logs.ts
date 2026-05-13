import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { queryVictoriaLogs } from './query-vlogs.js';

const execFileAsync = promisify(execFile);

/**
 * Collects logs for a container, trying VictoriaLogs first with `docker logs` fallback.
 *
 * Note: containers started with the syslog log driver will NOT have local Docker logs,
 * so the `docker logs` fallback only works for infrastructure containers (e.g. VictoriaLogs
 * itself) that use the default json-file driver.
 */
export const fetchContainerLogs = async (params: {
  readonly containerId: string;
  readonly componentName: string;
  readonly envName: string;
  readonly vlogsBaseUrl: string | undefined;
}): Promise<{ readonly content: string; readonly source: 'victorialogs' | 'docker' }> => {
  // Try VictoriaLogs first
  if (params.vlogsBaseUrl !== undefined) {
    try {
      const content = await queryVictoriaLogs({
        vlogsBaseUrl: params.vlogsBaseUrl,
        envName: params.envName,
        componentName: params.componentName,
      });
      return { content, source: 'victorialogs' };
    } catch {
      // VictoriaLogs unavailable — try docker logs fallback
    }
  }

  // Fallback to docker logs (works for containers with default log driver)
  const { stdout, stderr } = await execFileAsync('docker', [
    'logs',
    '--tail',
    '10000',
    params.containerId,
  ]);
  return { content: stdout + stderr, source: 'docker' };
};
