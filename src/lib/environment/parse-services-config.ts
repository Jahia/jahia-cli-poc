import { load } from 'js-yaml';

import type { ServiceGroupConfig, SelectionRule, ServicesConfig } from './types.js';

const VALID_SELECTIONS: readonly SelectionRule[] = ['always_included', 'at_most_one', 'zero_or_more'];

/**
 * Validates that a value is one of the allowed selection rules.
 */
const isValidSelection = (value: unknown): value is SelectionRule =>
  typeof value === 'string' && (VALID_SELECTIONS as readonly string[]).includes(value);

/**
 * Parses and validates the services config.yml content.
 * Returns a typed ServicesConfig with validated groups.
 */
export const parseServicesConfig = (yamlContent: string): ServicesConfig => {
  const parsed = load(yamlContent) as Record<string, unknown> | null;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Services config.yml must be a YAML object.');
  }

  const rawGroups = parsed['groups'];
  if (!rawGroups || typeof rawGroups !== 'object' || Array.isArray(rawGroups)) {
    throw new Error('Services config.yml must contain a "groups" object.');
  }

  const groupEntries = Object.entries(rawGroups as Record<string, unknown>);
  const groups: Record<string, ServiceGroupConfig> = {};

  groupEntries.forEach(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Group "${key}" must be an object.`);
    }

    const record = value as Record<string, unknown>;

    if (typeof record['label'] !== 'string') {
      throw new Error(`Group "${key}" must have a string "label" field.`);
    }
    if (typeof record['description'] !== 'string') {
      throw new Error(`Group "${key}" must have a string "description" field.`);
    }
    if (!isValidSelection(record['selection'])) {
      throw new Error(
        `Group "${key}" has invalid "selection" value. Must be one of: ${VALID_SELECTIONS.join(', ')}`,
      );
    }
    if (typeof record['order'] !== 'number') {
      throw new Error(`Group "${key}" must have a numeric "order" field.`);
    }

    groups[key] = {
      label: record['label'],
      description: record['description'],
      selection: record['selection'],
      order: record['order'],
    };
  });

  return { groups };
};
