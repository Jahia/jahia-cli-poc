import type { ComponentDefinition } from './types.js';

export const jahiaBrowsing: ComponentDefinition = {
  name: 'jahia-browsing',
  description: 'Jahia DXM browsing-only node (no processing, serves content)',
  image: 'jahia/jahia-ee',
  defaultTag: '8.2.1.0',
  ports: [
    { container: 8080, host: 8081 },
    { container: 8101, host: 8102 },
  ],
  env: {
    SUPER_USER_PASSWORD: 'root1234',
    JAHIA_DATABASE_URL: 'jdbc:postgresql://pgsql:5432/jahia',
    JAHIA_DATABASE_USER: 'jahia',
    JAHIA_DATABASE_PASSWORD: 'jahia',
    JAHIA_ELASTICSEARCH_ADDRESSES: 'http://elasticsearch:9200',
    MAX_RAM_PERCENTAGE: '80',
    PROCESSING_SERVER: 'false',
    CLUSTER_ENABLED: 'true',
  },
  volumes: [],
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
  dependsOn: ['jahia'],
  networkAliases: ['jahia-browsing'],
};
