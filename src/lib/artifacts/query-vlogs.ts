import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Queries VictoriaLogs for container logs using the syslog tag.
 *
 * The Docker syslog driver sets the tag to `jahia-cli-{envName}-{{.Name}}`
 * where `{{.Name}}` is the Docker container name `jahia-cli-{envName}-{componentName}`.
 * VictoriaLogs stores this in the `app_name` field (rfc5424 APP-NAME).
 */
export const queryVictoriaLogs = async (params: {
  readonly vlogsBaseUrl: string;
  readonly envName: string;
  readonly componentName: string;
  readonly limit?: number | undefined;
}): Promise<string> => {
  const containerDockerName = `jahia-cli-${params.envName}-${params.componentName}`;
  const syslogTag = `jahia-cli-${params.envName}-${containerDockerName}`;
  const limit = params.limit ?? 10000;

  const query = `app_name:${syslogTag}`;
  const url = `${params.vlogsBaseUrl}/select/logsql/query?query=${encodeURIComponent(query)}&limit=${String(limit)}`;

  const { stdout } = await execFileAsync('curl', ['-sf', url], {
    maxBuffer: 50 * 1024 * 1024,
  });

  // Extract just the _msg field from each JSON line for readable log output
  const lines = stdout.trim().split('\n').filter((line) => line.length > 0);
  const messages = lines.map((line) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      return typeof parsed['_msg'] === 'string' ? parsed['_msg'] : line;
    } catch {
      return line;
    }
  });

  return messages.join('\n');
};
