import { describe, expect, test, beforeEach, afterEach } from 'vitest';

import { resolveEnvVars, resolveEnvVarsInRecord } from '../../../src/lib/config/resolve-env-vars.js';

describe('resolveEnvVars', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('returns string unchanged when no env var patterns are present', () => {
    expect(resolveEnvVars('hello world')).toBe('hello world');
  });

  test('returns empty string unchanged', () => {
    expect(resolveEnvVars('')).toBe('');
  });

  test('leaves bare $ characters unchanged', () => {
    expect(resolveEnvVars('price is $5')).toBe('price is $5');
  });

  test('leaves malformed patterns unchanged', () => {
    expect(resolveEnvVars('${}')).toBe('${}');
    expect(resolveEnvVars('${ }')).toBe('${ }');
    expect(resolveEnvVars('${123}')).toBe('${123}');
  });

  test('resolves ${VAR} from process.env', () => {
    process.env['TEST_IMAGE'] = 'my-registry.example.com/jahia/jahia-ee';
    expect(resolveEnvVars('${TEST_IMAGE}')).toBe('my-registry.example.com/jahia/jahia-ee');
  });

  test('resolves ${VAR:-default} to env value when set', () => {
    process.env['JAHIA_VERSION'] = '8.3.0.0';
    expect(resolveEnvVars('${JAHIA_VERSION:-8.2.1.0}')).toBe('8.3.0.0');
  });

  test('resolves ${VAR:-default} to default when env var is not set', () => {
    delete process.env['JAHIA_VERSION'];
    expect(resolveEnvVars('${JAHIA_VERSION:-8.2.1.0}')).toBe('8.2.1.0');
  });

  test('resolves ${VAR:-} to empty string when env var is not set', () => {
    delete process.env['OPTIONAL_VAR'];
    expect(resolveEnvVars('${OPTIONAL_VAR:-}')).toBe('');
  });

  test('throws on ${VAR} when env var is not set and no default provided', () => {
    delete process.env['REQUIRED_VAR'];
    expect(() => resolveEnvVars('${REQUIRED_VAR}')).toThrow(
      'Environment variable "REQUIRED_VAR" is not set',
    );
  });

  test('resolves multiple patterns in one string', () => {
    process.env['REGISTRY'] = 'my-registry.io';
    process.env['IMAGE'] = 'jahia/jahia-ee';
    expect(resolveEnvVars('${REGISTRY}/${IMAGE}:${TAG:-latest}')).toBe(
      'my-registry.io/jahia/jahia-ee:latest',
    );
  });

  test('supports underscore-prefixed variable names', () => {
    process.env['_MY_VAR'] = 'value';
    expect(resolveEnvVars('${_MY_VAR}')).toBe('value');
  });

  test('handles mixed literal and variable content', () => {
    process.env['VERSION'] = '8.3.0.0';
    expect(resolveEnvVars('jahia/jahia-ee:${VERSION}')).toBe('jahia/jahia-ee:8.3.0.0');
  });

  test('uses env value even when it is empty string', () => {
    process.env['EMPTY_VAR'] = '';
    expect(resolveEnvVars('${EMPTY_VAR:-fallback}')).toBe('');
  });
});

describe('resolveEnvVarsInRecord', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('resolves env vars in all record values', () => {
    process.env['DB_HOST'] = 'postgres.local';
    const result = resolveEnvVarsInRecord({
      HOST: '${DB_HOST:-localhost}',
      PORT: '5432',
    });
    expect(result).toEqual({
      HOST: 'postgres.local',
      PORT: '5432',
    });
  });

  test('returns empty record unchanged', () => {
    expect(resolveEnvVarsInRecord({})).toEqual({});
  });

  test('applies defaults when env vars are not set', () => {
    delete process.env['MISSING_VAR'];
    const result = resolveEnvVarsInRecord({
      KEY: '${MISSING_VAR:-default_value}',
    });
    expect(result).toEqual({ KEY: 'default_value' });
  });
});
