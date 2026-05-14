import { describe, expect, test } from 'vitest';

import {
  DEFAULT_DOCKERFILE,
  DEFAULT_IMAGE_NAME,
  buildBuildxArgs,
  parseKeyValueArgs,
  resolveImageTag,
} from '../../../src/lib/tests/build-image.js';

describe('resolveImageTag', () => {
  test('combines image name and version', () => {
    expect(resolveImageTag('jahia-tests', '1.2.3')).toBe('jahia-tests:1.2.3');
  });

  test('uses custom image name', () => {
    expect(resolveImageTag('my-image', 'latest')).toBe('my-image:latest');
  });
});

describe('parseKeyValueArgs', () => {
  test('parses simple KEY=VALUE pairs', () => {
    const result = parseKeyValueArgs(['FOO=bar', 'BAZ=qux']);
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  test('handles values containing equals signs', () => {
    const result = parseKeyValueArgs(['URL=http://host:8080?a=1']);
    expect(result).toEqual({ URL: 'http://host:8080?a=1' });
  });

  test('throws on missing equals sign', () => {
    expect(() => parseKeyValueArgs(['INVALID'])).toThrow('Invalid KEY=VALUE');
  });

  test('handles empty value', () => {
    const result = parseKeyValueArgs(['KEY=']);
    expect(result).toEqual({ KEY: '' });
  });
});

describe('buildBuildxArgs', () => {
  test('builds minimal args', () => {
    const args = buildBuildxArgs({
      dockerfile: 'docker/Dockerfile.local',
      tag: 'jahia-tests:1.0',
      baseVersion: '1.0',
    });

    expect(args).toContain('buildx');
    expect(args).toContain('build');
    expect(args).toContain('-f');
    expect(args).toContain('docker/Dockerfile.local');
    expect(args).toContain('-t');
    expect(args).toContain('jahia-tests:1.0');
    expect(args).toContain('--load');
    expect(args.some((a) => a.includes('BASE_VERSION=1.0'))).toBe(true);
    // Context dir should be 'docker'
    expect(args[args.length - 1]).toBe('docker');
  });

  test('includes platform when specified', () => {
    const args = buildBuildxArgs({
      dockerfile: DEFAULT_DOCKERFILE,
      tag: `${DEFAULT_IMAGE_NAME}:latest`,
      baseVersion: 'latest',
      platform: 'linux/amd64',
    });

    expect(args).toContain('--platform');
    expect(args).toContain('linux/amd64');
  });

  test('includes --no-cache when specified', () => {
    const args = buildBuildxArgs({
      dockerfile: DEFAULT_DOCKERFILE,
      tag: `${DEFAULT_IMAGE_NAME}:latest`,
      baseVersion: 'latest',
      noCache: true,
    });

    expect(args).toContain('--no-cache');
  });

  test('includes extra build args', () => {
    const args = buildBuildxArgs({
      dockerfile: DEFAULT_DOCKERFILE,
      tag: `${DEFAULT_IMAGE_NAME}:latest`,
      baseVersion: 'latest',
      extraBuildArgs: { CYPRESS_VERSION: '13.0.0', NODE_VERSION: '20' },
    });

    const buildArgIndices = args.reduce<readonly number[]>(
      (acc, val, idx) => (val === '--build-arg' ? [...acc, idx] : acc),
      [],
    );
    // BASE_VERSION + 2 extra = 3 build args
    expect(buildArgIndices.length).toBe(3);
  });

  test('uses . as context when dockerfile has no directory', () => {
    const args = buildBuildxArgs({
      dockerfile: 'Dockerfile',
      tag: 'test:1.0',
      baseVersion: '1.0',
    });

    expect(args[args.length - 1]).toBe('.');
  });
});
