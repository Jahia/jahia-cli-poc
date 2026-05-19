import { resolveEnvVars, resolveEnvVarsInRecord } from './resolve-env-vars.js';
import type { TestContainerConfig } from './types.js';

/**
 * Parses and validates the optional tests.container section.
 * All fields are optional — only provided values are included.
 * String values support ${VAR:-default} env var resolution.
 */
export const parseTestContainerConfig = (rawContainer: unknown): TestContainerConfig | undefined => {
  if (rawContainer === undefined) {
    return undefined;
  }

  if (typeof rawContainer !== 'object' || rawContainer === null || Array.isArray(rawContainer)) {
    throw new Error('Configuration "tests.container" must be an object when provided.');
  }

  const record = rawContainer as Record<string, unknown>;

  if (record['dockerfile'] !== undefined && typeof record['dockerfile'] !== 'string') {
    throw new Error('Configuration "tests.container.dockerfile" must be a string when provided.');
  }

  if (record['image'] !== undefined && typeof record['image'] !== 'string') {
    throw new Error('Configuration "tests.container.image" must be a string when provided.');
  }

  if (record['tag'] !== undefined && typeof record['tag'] !== 'string') {
    throw new Error('Configuration "tests.container.tag" must be a string when provided.');
  }

  if (record['context'] !== undefined && typeof record['context'] !== 'string') {
    throw new Error('Configuration "tests.container.context" must be a string when provided.');
  }

  if (record['platform'] !== undefined && typeof record['platform'] !== 'string') {
    throw new Error('Configuration "tests.container.platform" must be a string when provided.');
  }

  if (record['buildArgs'] !== undefined) {
    if (typeof record['buildArgs'] !== 'object' || record['buildArgs'] === null || Array.isArray(record['buildArgs'])) {
      throw new Error('Configuration "tests.container.buildArgs" must be an object when provided.');
    }
  }

  const config: TestContainerConfig = {
    ...(record['dockerfile'] !== undefined ? { dockerfile: record['dockerfile'] } : {}),
    ...(record['image'] !== undefined ? { image: resolveEnvVars(record['image']) } : {}),
    ...(record['tag'] !== undefined ? { tag: resolveEnvVars(record['tag']) } : {}),
    ...(record['context'] !== undefined ? { context: record['context'] } : {}),
    ...(record['platform'] !== undefined ? { platform: record['platform'] } : {}),
    ...(record['buildArgs'] !== undefined ? { buildArgs: resolveEnvVarsInRecord(record['buildArgs'] as Record<string, string>) } : {}),
  };

  return Object.keys(config).length > 0 ? config : undefined;
};
