import { describe, test, expect } from 'vitest';

import { parseServiceMetadata } from '../../../src/lib/environment/parse-service-metadata.js';

describe('parseServiceMetadata', () => {
  test('parses valid service metadata', () => {
    const yaml = `
x-metadata:
  name: "PostgreSQL 18"
  description: "PostgreSQL database for Jahia"
  group: "database"
  requires: []

services:
  postgres:
    image: postgres:18
`;

    const result = parseServiceMetadata(yaml, 'postgres-18.yml');

    expect(result.name).toBe('PostgreSQL 18');
    expect(result.description).toBe('PostgreSQL database for Jahia');
    expect(result.group).toBe('database');
    expect(result.requires).toEqual([]);
    expect(result.notes).toBeUndefined();
  });

  test('parses requires with service dependency', () => {
    const yaml = `
x-metadata:
  name: "Kibana"
  description: "Kibana dashboard"
  group: "search"
  requires:
    - service: "elasticsearch"
`;

    const result = parseServiceMetadata(yaml, 'kibana.yml');

    expect(result.requires).toHaveLength(1);
    expect(result.requires[0]).toEqual({ service: 'elasticsearch', group: undefined });
  });

  test('parses requires with group dependency', () => {
    const yaml = `
x-metadata:
  name: "Jahia"
  description: "Jahia Core"
  group: "core"
  requires:
    - group: "database"
`;

    const result = parseServiceMetadata(yaml, 'jahia.yml');

    expect(result.requires).toHaveLength(1);
    expect(result.requires[0]).toEqual({ service: undefined, group: 'database' });
  });

  test('parses optional notes field', () => {
    const yaml = `
x-metadata:
  name: "Test"
  description: "A test service"
  group: "testing"
  requires: []
  notes: "Some important notes"

services:
  test:
    image: test:latest
`;

    const result = parseServiceMetadata(yaml, 'test.yml');

    expect(result.notes).toBe('Some important notes');
  });

  test('handles missing requires field gracefully', () => {
    const yaml = `
x-metadata:
  name: "Simple"
  description: "No deps"
  group: "core"

services:
  simple:
    image: simple:1
`;

    const result = parseServiceMetadata(yaml, 'simple.yml');

    expect(result.requires).toEqual([]);
  });

  test('throws for non-YAML content', () => {
    expect(() => parseServiceMetadata('', 'empty.yml')).toThrow('must be a valid YAML object');
  });

  test('throws when x-metadata is missing', () => {
    const yaml = `
services:
  db:
    image: postgres:16
`;
    expect(() => parseServiceMetadata(yaml, 'db.yml')).toThrow(
      'missing or invalid "x-metadata"',
    );
  });

  test('throws when name is missing from metadata', () => {
    const yaml = `
x-metadata:
  description: "desc"
  group: "core"
  requires: []
`;
    expect(() => parseServiceMetadata(yaml, 'bad.yml')).toThrow('x-metadata.name must be a string');
  });

  test('throws when description is missing from metadata', () => {
    const yaml = `
x-metadata:
  name: "Name"
  group: "core"
  requires: []
`;
    expect(() => parseServiceMetadata(yaml, 'bad.yml')).toThrow(
      'x-metadata.description must be a string',
    );
  });

  test('treats group as optional', () => {
    const yaml = `
x-metadata:
  name: "Name"
  description: "desc"
  requires: []
`;
    const result = parseServiceMetadata(yaml, 'no-group.yml');
    expect(result.group).toBeUndefined();
  });

  test('throws when requires entry has neither service nor group', () => {
    const yaml = `
x-metadata:
  name: "Name"
  description: "desc"
  group: "core"
  requires:
    - other: "invalid"
`;
    expect(() => parseServiceMetadata(yaml, 'bad.yml')).toThrow(
      'must have "service" or "group"',
    );
  });

  test('throws when requires entry is not an object', () => {
    const yaml = `
x-metadata:
  name: "Name"
  description: "desc"
  group: "core"
  requires:
    - "just a string"
`;
    expect(() => parseServiceMetadata(yaml, 'bad.yml')).toThrow('must be an object');
  });

  test('parses optional flag when true', () => {
    const yaml = `
x-metadata:
  name: "Kibana"
  description: "Kibana dashboard"
  group: "search"
  optional: true
  requires: []
`;

    const result = parseServiceMetadata(yaml, 'kibana.yml');

    expect(result.optional).toBe(true);
  });

  test('defaults optional to false when not specified', () => {
    const yaml = `
x-metadata:
  name: "PostgreSQL"
  description: "Postgres DB"
  group: "database"
  requires: []
`;

    const result = parseServiceMetadata(yaml, 'postgres.yml');

    expect(result.optional).toBe(false);
  });
});
