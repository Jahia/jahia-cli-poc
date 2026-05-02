import type { ComponentDefinition } from './types.js';

export const pgsql: ComponentDefinition = {
  name: 'pgsql',
  description: 'PostgreSQL database server for Jahia content storage',
  image: 'postgres',
  defaultTag: '16-alpine',
  ports: [{ container: 5432, host: 5432 }],
  env: {
    POSTGRES_DB: 'jahia',
    POSTGRES_USER: 'jahia',
    POSTGRES_PASSWORD: 'jahia',
  },
  volumes: [{ name: 'pgsql-data', containerPath: '/var/lib/postgresql/data' }],
  healthcheck: {
    command: ['CMD-SHELL', 'pg_isready -U jahia'],
    intervalSeconds: 5,
    timeoutSeconds: 5,
    retries: 5,
    startPeriodSeconds: 10,
  },
  dependsOn: [],
  networkAliases: ['pgsql', 'database'],
};
