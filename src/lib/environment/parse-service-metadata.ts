import { load } from 'js-yaml';

import type { ServiceDependency, ServiceMetadata } from './types.js';

/**
 * Parses a single dependency entry from x-metadata.requires.
 */
const parseDependency = (raw: unknown, filename: string, index: number): ServiceDependency => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `Service "${filename}": x-metadata.requires[${String(index)}] must be an object.`,
    );
  }

  const record = raw as Record<string, unknown>;
  const service = typeof record['service'] === 'string' ? record['service'] : undefined;
  const group = typeof record['group'] === 'string' ? record['group'] : undefined;

  if (!service && !group) {
    throw new Error(
      `Service "${filename}": x-metadata.requires[${String(index)}] must have "service" or "group".`,
    );
  }

  return { service, group };
};

/**
 * Parses the x-metadata extension field from a service YAML file.
 * Throws descriptive errors if the metadata is missing or malformed.
 */
export const parseServiceMetadata = (yamlContent: string, filename: string): ServiceMetadata => {
  const parsed = load(yamlContent) as Record<string, unknown> | null;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Service "${filename}": file must be a valid YAML object.`);
  }

  const metadata = parsed['x-metadata'];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`Service "${filename}": missing or invalid "x-metadata" top-level field.`);
  }

  const record = metadata as Record<string, unknown>;

  if (typeof record['name'] !== 'string') {
    throw new Error(`Service "${filename}": x-metadata.name must be a string.`);
  }
  if (typeof record['description'] !== 'string') {
    throw new Error(`Service "${filename}": x-metadata.description must be a string.`);
  }
  const group = typeof record['group'] === 'string' ? record['group'] : undefined;

  const rawRequires = record['requires'];
  const requires: readonly ServiceDependency[] = Array.isArray(rawRequires)
    ? rawRequires.map((dep, i) => parseDependency(dep, filename, i))
    : [];

  const notes = typeof record['notes'] === 'string' ? record['notes'] : undefined;
  const optional = record['optional'] === true;

  return {
    name: record['name'],
    description: record['description'],
    group,
    optional,
    requires,
    notes,
  };
};
