import type { ComponentDefinition } from './types.js';

export const smtpServer: ComponentDefinition = {
  name: 'smtp-server',
  description: 'Mailpit SMTP server for email testing',
  image: 'axllent/mailpit',
  defaultTag: 'v1.27',
  ports: [
    { container: 1025, host: 1025 },
    { container: 8025, host: 8025 },
  ],
  env: {},
  volumes: [],
  healthcheck: {
    command: ['CMD-SHELL', 'wget -qO- http://localhost:8025/api/v1/info || exit 1'],
    intervalSeconds: 10,
    timeoutSeconds: 3,
    retries: 3,
    startPeriodSeconds: 5,
  },
  dependsOn: [],
  networkAliases: ['smtp-server'],
  category: 'utility',
  isTransparent: false,
  multiInstance: false,
  providerSupport: ['docker'],
  envInjections: {
    jahia: { SMTP_SERVER_URL: '${SMTP_SERVER_URL:-smtp://smtp-server:1025}' },
  },
};
