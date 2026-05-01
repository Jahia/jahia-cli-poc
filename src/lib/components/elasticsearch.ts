import type { ComponentDefinition } from './types.js';

export const elasticsearch: ComponentDefinition = {
  name: 'elasticsearch',
  description: 'Elasticsearch search engine for Jahia content indexing',
  image: 'docker.elastic.co/elasticsearch/elasticsearch',
  defaultTag: '7.17.24',
  ports: [{ container: 9200, host: 9200 }],
  env: {
    discovery_type: 'single-node',
    'xpack.security.enabled': 'false',
    ES_JAVA_OPTS: '-Xms512m -Xmx512m',
  },
  volumes: [{ name: 'es-data', containerPath: '/usr/share/elasticsearch/data' }],
  healthcheck: {
    command: ['CMD-SHELL', 'curl -f http://localhost:9200/_cluster/health || exit 1'],
    intervalSeconds: 10,
    timeoutSeconds: 5,
    retries: 5,
    startPeriodSeconds: 30,
  },
  dependsOn: [],
  networkAliases: ['elasticsearch', 'es'],
};
