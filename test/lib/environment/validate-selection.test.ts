import { describe, test, expect } from 'vitest';

import { validateSelection } from '../../../src/lib/environment/validate-selection.js';
import type { ServiceSelection } from '../../../src/lib/environment/types.js';

const makeSelection = (
  filename: string,
  name: string,
  group: string,
  requires: ServiceSelection['metadata']['requires'] = [],
): ServiceSelection => ({
  filename,
  metadata: { name, description: '', group, requires },
});

describe('validateSelection', () => {
  test('returns empty array for valid selection with no dependencies', () => {
    const selection = [
      makeSelection('jahia.yml', 'Jahia', 'core'),
      makeSelection('postgres-18.yml', 'PostgreSQL 18', 'database'),
    ];

    expect(validateSelection(selection)).toEqual([]);
  });

  test('returns empty array when service dependency is satisfied', () => {
    const selection = [
      makeSelection('elasticsearch.yml', 'Elasticsearch', 'search'),
      makeSelection('kibana.yml', 'Kibana', 'search', [{ service: 'elasticsearch' }]),
    ];

    expect(validateSelection(selection)).toEqual([]);
  });

  test('returns error when service dependency is not satisfied', () => {
    const selection = [
      makeSelection('kibana.yml', 'Kibana', 'search', [{ service: 'elasticsearch' }]),
    ];

    const errors = validateSelection(selection);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Kibana');
    expect(errors[0]).toContain('elasticsearch');
    expect(errors[0]).toContain('not selected');
  });

  test('returns empty array when group dependency is satisfied', () => {
    const selection = [
      makeSelection('postgres-18.yml', 'PostgreSQL 18', 'database'),
      makeSelection('jahia.yml', 'Jahia', 'core', [{ group: 'database' }]),
    ];

    expect(validateSelection(selection)).toEqual([]);
  });

  test('returns error when group dependency is not satisfied', () => {
    const selection = [
      makeSelection('jahia.yml', 'Jahia', 'core', [{ group: 'database' }]),
    ];

    const errors = validateSelection(selection);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Jahia');
    expect(errors[0]).toContain('database');
    expect(errors[0]).toContain('none is selected');
  });

  test('returns multiple errors for multiple unmet dependencies', () => {
    const selection = [
      makeSelection('kibana.yml', 'Kibana', 'search', [{ service: 'elasticsearch' }]),
      makeSelection('haproxy.yml', 'HAProxy', 'infrastructure', [{ group: 'cluster' }]),
    ];

    const errors = validateSelection(selection);

    expect(errors).toHaveLength(2);
  });

  test('handles service dependency with .yml extension in requires', () => {
    const selection = [
      makeSelection('elasticsearch.yml', 'Elasticsearch', 'search'),
      makeSelection('kibana.yml', 'Kibana', 'search', [{ service: 'elasticsearch.yml' }]),
    ];

    expect(validateSelection(selection)).toEqual([]);
  });

  test('returns empty array for empty selection', () => {
    expect(validateSelection([])).toEqual([]);
  });
});
