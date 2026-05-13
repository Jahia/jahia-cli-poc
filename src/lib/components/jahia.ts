import type { ComponentDefinition } from './types.js';

export const jahia: ComponentDefinition = {
  name: 'jahia',
  description: 'Jahia DXM (Digital Experience Manager) processing server',
  image: 'jahia/jahia-ee',
  defaultTag: '8.2.1.0',
  ports: [
    { container: 8080, host: 8080 },
    { container: 8101, host: 8101 },
  ],
  env: {
    SUPER_USER_PASSWORD: '${SUPER_USER_PASSWORD:-root1234}',
    MAX_RAM_PERCENTAGE: '${MAX_RAM_PERCENTAGE:-80}',
    PROCESSING_SERVER: 'true',
    JAHIA_LICENSE: '${JAHIA_LICENSE:-}',
    JPDA: '${JPDA:-}',
  },
  volumes: [
    { name: 'jahia-data', containerPath: '/var/jahia/repository' },
  ],
  healthcheck: {
    command: [
      'CMD-SHELL',
      'curl -f http://localhost:8080/modules/healthcheck || exit 1',
    ],
    intervalSeconds: 30,
    timeoutSeconds: 10,
    retries: 10,
    startPeriodSeconds: 120,
  },
  dependsOn: [],
  networkAliases: ['jahia'],
  category: 'core',
  isTransparent: false,
  multiInstance: false,
  providerSupport: ['docker', 'jahiacloudv1'],
  artifacts: ['/var/log/jahia/jahia-error'],
};

