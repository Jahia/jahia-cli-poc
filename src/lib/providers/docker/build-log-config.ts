import type { LogDriverConfig } from './container.js';

/**
 * Log driver configuration for forwarding logs to VictoriaLogs via syslog.
 */
export const buildLogConfig = (envName: string, syslogPort: number): LogDriverConfig => ({
  driver: 'syslog',
  options: {
    'syslog-address': `tcp://127.0.0.1:${String(syslogPort)}`,
    'syslog-format': 'rfc5424',
    'tag': `jahia-cli-${envName}-{{.Name}}`,
  },
});
