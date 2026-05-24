import { describe, test, expect } from 'vitest';

import { parseServicesConfig } from '../../../src/lib/environment/parse-services-config.js';

describe('parseServicesConfig', () => {
  test('parses valid config with multiple groups', () => {
    const yaml = `
groups:
  core:
    label: "Jahia Core"
    description: "Primary Jahia application server"
    selection: "always_included"
    order: 10
  database:
    label: "Database"
    description: "Database backend"
    selection: "at_most_one"
    order: 20
  search:
    label: "Search"
    description: "Search services"
    selection: "zero_or_more"
    order: 40
`;

    const result = parseServicesConfig(yaml);

    expect(Object.keys(result.groups)).toHaveLength(3);
    expect(result.groups['core']).toEqual({
      label: 'Jahia Core',
      description: 'Primary Jahia application server',
      selection: 'always_included',
      order: 10,
    });
    expect(result.groups['database']?.selection).toBe('at_most_one');
    expect(result.groups['search']?.selection).toBe('zero_or_more');
  });

  test('throws for empty/null content', () => {
    expect(() => parseServicesConfig('')).toThrow('must be a YAML object');
  });

  test('throws when groups key is missing', () => {
    expect(() => parseServicesConfig('other: true')).toThrow('must contain a "groups" object');
  });

  test('throws when groups is not an object', () => {
    expect(() => parseServicesConfig('groups: [1, 2]')).toThrow('must contain a "groups" object');
  });

  test('throws when group entry is not an object', () => {
    expect(() => parseServicesConfig('groups:\n  core: "string"')).toThrow(
      'Group "core" must be an object',
    );
  });

  test('throws when label is missing', () => {
    const yaml = `
groups:
  core:
    description: "desc"
    selection: "always_included"
    order: 10
`;
    expect(() => parseServicesConfig(yaml)).toThrow('must have a string "label"');
  });

  test('throws when description is missing', () => {
    const yaml = `
groups:
  core:
    label: "Core"
    selection: "always_included"
    order: 10
`;
    expect(() => parseServicesConfig(yaml)).toThrow('must have a string "description"');
  });

  test('throws for invalid selection value', () => {
    const yaml = `
groups:
  core:
    label: "Core"
    description: "desc"
    selection: "invalid_rule"
    order: 10
`;
    expect(() => parseServicesConfig(yaml)).toThrow('invalid "selection" value');
  });

  test('throws when order is not a number', () => {
    const yaml = `
groups:
  core:
    label: "Core"
    description: "desc"
    selection: "always_included"
    order: "first"
`;
    expect(() => parseServicesConfig(yaml)).toThrow('must have a numeric "order"');
  });
});
