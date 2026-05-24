import { describe, test, expect } from 'vitest';

import { parseComposePsOutput } from '../../../../src/lib/providers/docker-compose/parse-compose-ps.js';

describe('parseComposePsOutput', () => {
  test('parses NDJSON output with multiple services', () => {
    const stdout = [
      '{"ID":"abc123","Name":"project-jahia-1","Service":"jahia","State":"running","Health":"healthy"}',
      '{"ID":"def456","Name":"project-postgres-1","Service":"postgres","State":"running","Health":""}',
    ].join('\n');

    const result = parseComposePsOutput(stdout);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'jahia',
      status: 'running',
      health: 'healthy',
      containerId: 'abc123',
    });
    expect(result[1]).toEqual({
      name: 'postgres',
      status: 'running',
      health: 'none',
      containerId: 'def456',
    });
  });

  test('returns empty array for empty output', () => {
    expect(parseComposePsOutput('')).toEqual([]);
    expect(parseComposePsOutput('  \n  ')).toEqual([]);
  });

  test('maps exited state to stopped', () => {
    const stdout = '{"ID":"x","Name":"project-db-1","Service":"db","State":"exited","Health":""}';

    const result = parseComposePsOutput(stdout);

    expect(result[0]?.status).toBe('stopped');
  });

  test('maps dead state to stopped', () => {
    const stdout = '{"ID":"x","Name":"project-db-1","Service":"db","State":"dead","Health":""}';

    const result = parseComposePsOutput(stdout);

    expect(result[0]?.status).toBe('stopped');
  });

  test('maps created state to starting', () => {
    const stdout = '{"ID":"x","Name":"project-app-1","Service":"app","State":"created","Health":""}';

    const result = parseComposePsOutput(stdout);

    expect(result[0]?.status).toBe('starting');
  });

  test('maps unknown state to not_found', () => {
    const stdout = '{"ID":"x","Name":"project-svc-1","Service":"svc","State":"paused","Health":""}';

    const result = parseComposePsOutput(stdout);

    expect(result[0]?.status).toBe('not_found');
  });

  test('maps health statuses correctly', () => {
    const cases = [
      { health: 'healthy', expected: 'healthy' },
      { health: 'unhealthy', expected: 'unhealthy' },
      { health: 'starting', expected: 'starting' },
      { health: '', expected: 'none' },
    ] as const;

    cases.forEach(({ health, expected }) => {
      const stdout = `{"ID":"x","Name":"c","Service":"svc","State":"running","Health":"${health}"}`;
      const result = parseComposePsOutput(stdout);
      expect(result[0]?.health).toBe(expected);
    });
  });

  test('prefers Service field over Name for component name', () => {
    const stdout = '{"ID":"x","Name":"project-myservice-1","Service":"myservice","State":"running","Health":""}';

    const result = parseComposePsOutput(stdout);

    expect(result[0]?.name).toBe('myservice');
  });

  test('falls back to Name when Service is missing', () => {
    const stdout = '{"ID":"x","Name":"my-container","State":"running","Health":""}';

    const result = parseComposePsOutput(stdout);

    expect(result[0]?.name).toBe('my-container');
  });

  test('handles missing ID gracefully', () => {
    const stdout = '{"Name":"c","Service":"svc","State":"running","Health":""}';

    const result = parseComposePsOutput(stdout);

    expect(result[0]?.containerId).toBeUndefined();
  });
});
