import { describe, test, expect } from 'vitest';

import { assembleComposeFile } from '../../../src/lib/environment/assemble-compose-file.js';
import type { ServiceSelection } from '../../../src/lib/environment/types.js';

const makeSelection = (filename: string): ServiceSelection => ({
  filename,
  metadata: { name: filename, description: '', group: 'test', requires: [] },
});

describe('assembleComposeFile', () => {
  test('generates include directives for selected services', () => {
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

  test('always includes networks section', () => {
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

  test('generates valid YAML structure', () => {
    const result = assembleComposeFile([makeSelection('jahia.yml')]);

    // Should start with include: and end with networks
    const lines = result.split('\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe('include:');
    expect(lines[lines.length - 1]).toBe('  stack:');
  });
});
