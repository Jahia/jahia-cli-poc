import type { ComponentDefinition } from './types.js';

export const victorialogs: ComponentDefinition = {
  name: 'victorialogs',
  description: 'VictoriaLogs log aggregation for AI-friendly log consumption',
  image: 'victoriametrics/victoria-logs',
  defaultTag: 'v1.15.0-victorialogs',
  ports: [
    { container: 9428, host: 9428 },
    { container: 5140, host: 5140 },
  ],
  env: {},
  volumes: [
    { name: 'victorialogs-data', containerPath: '/vlogs' },
  ],
  healthcheck: {
    command: ['CMD-SHELL', 'wget -qO- http://localhost:9428/health || exit 1'],
    intervalSeconds: 5,
    timeoutSeconds: 3,
    retries: 3,
    startPeriodSeconds: 5,
  },
  dependsOn: [],
  networkAliases: ['victorialogs', 'logs'],
  category: 'infrastructure',
  isTransparent: true,
  multiInstance: false,
  providerSupport: ['docker'],
  args: ['-syslog.listenAddr.tcp=:5140', '-syslog.listenAddr.udp=:5140'],
};
