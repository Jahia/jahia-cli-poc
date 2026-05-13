import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Queries VictoriaLogs for container logs using the syslog tag.
 *
 * The Docker syslog driver sets the tag to `jahia-cli-{envName}-{{.Name}}`
 * where `{{.Name}}` is the Docker container name `jahia-cli-{envName}-{componentName}`.
 * VictoriaLogs stores this in the `syslog_appname` field.
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

  // Use curl via execFile for consistency with the rest of the codebase (no native fetch dependency)
  const query = `syslog_appname:${syslogTag}`;
  const url = `${params.vlogsBaseUrl}/select/logsql/query?query=${encodeURIComponent(query)}&limit=${String(limit)}`;

  const { stdout } = await execFileAsync('curl', ['-sf', url], {
    maxBuffer: 50 * 1024 * 1024,
  });

  return stdout;
};
