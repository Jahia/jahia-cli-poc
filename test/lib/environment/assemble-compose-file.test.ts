import { describe, test, expect } from 'vitest';

import { assembleComposeFile } from '../../../src/lib/environment/assemble-compose-file.js';
import type { ServiceSelection } from '../../../src/lib/environment/types.js';

const makeSelection = (filename: string): ServiceSelection => ({
  filename,
  metadata: { name: filename, description: '', group: 'test', requires: [] },
});

const SAMPLE_COMPOSE = `# Header comment
# Another comment

include:
  - path: ./services/jahia.yml
  - path: ./services/postgres.yml

networks:
  stack:
    driver: bridge
    ipam:
      config:
        - subnet: 172.24.24.0/24
`;

describe('assembleComposeFile', () => {
  test('generates include directives for selected services (no existing content)', () => {
    const services = [
      makeSelection('jahia.yml'),
      makeSelection('postgres-18.yml'),
      makeSelection('cypress.yml'),
    ];

    const result = assembleComposeFile(services);

    expect(result).toContain('include:');
    expect(result).toContain('  - path: ./services/jahia.yml');
    expect(result).toContain('  - path: ./services/postgres-18.yml');
    expect(result).toContain('  - path: ./services/cypress.yml');
  });

  test('always includes networks section (no existing content)', () => {
    const result = assembleComposeFile([makeSelection('jahia.yml')]);

    expect(result).toContain('networks:');
    expect(result).toContain('  stack:');
  });

  test('handles empty selection (no include section)', () => {
    const result = assembleComposeFile([]);

    expect(result).not.toContain('include:');
    expect(result).toContain('networks:');
    expect(result).toContain('  stack:');
  });

  test('preserves order of services in include directives', () => {
    const services = [
      makeSelection('postgres-18.yml'),
      makeSelection('jahia.yml'),
    ];

    const result = assembleComposeFile(services);
    const lines = result.split('\n');
    const pgIndex = lines.findIndex((l) => l.includes('postgres-18.yml'));
    const jahiaIndex = lines.findIndex((l) => l.includes('jahia.yml'));

    expect(pgIndex).toBeLessThan(jahiaIndex);
  });

  test('generates valid YAML structure (no existing content)', () => {
    const result = assembleComposeFile([makeSelection('jahia.yml')]);

    // Should start with include: and end with networks
    const lines = result.split('\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe('include:');
    expect(lines[lines.length - 1]).toBe('  stack:');
  });

  test('updates existing compose file preserving header and networks', () => {
    const services = [
      makeSelection('jahia.yml'),
      makeSelection('postgres-18.yml'),
      makeSelection('elasticsearch.yml'),
    ];

    const result = assembleComposeFile(services, SAMPLE_COMPOSE);

    expect(result).toContain('# Header comment');
    expect(result).toContain('# Another comment');
    expect(result).toContain('  - path: ./services/jahia.yml');
    expect(result).toContain('  - path: ./services/postgres-18.yml');
    expect(result).toContain('  - path: ./services/elasticsearch.yml');
    expect(result).not.toContain('  - path: ./services/postgres.yml');
    expect(result).toContain('networks:');
    expect(result).toContain('    driver: bridge');
    expect(result).toContain('        - subnet: 172.24.24.0/24');
  });

  test('preserves full networks section from existing file', () => {
    const services = [makeSelection('jahia.yml')];
    const result = assembleComposeFile(services, SAMPLE_COMPOSE);

    const networksIndex = result.indexOf('networks:');
    const afterNetworks = result.slice(networksIndex);
    expect(afterNetworks).toContain('driver: bridge');
    expect(afterNetworks).toContain('subnet: 172.24.24.0/24');
  });

  test('falls back to scratch when existing content has no include section', () => {
    const services = [makeSelection('jahia.yml')];
    const result = assembleComposeFile(services, '# just a comment\nnetworks:\n  stack:\n');

    expect(result).toContain('include:');
    expect(result).toContain('  - path: ./services/jahia.yml');
  });

  test('falls back to scratch when existing content is empty', () => {
    const services = [makeSelection('jahia.yml')];
    const result = assembleComposeFile(services, '');

    expect(result).toContain('include:');
    expect(result).toContain('networks:');
  });
});
