import { describe, expect, test } from 'vitest';

import { resolveNetworkMode } from '../../../src/lib/state/detect-docker-context.js';

describe('resolveNetworkMode', () => {
  test('returns "docker-network" when env var is "docker-network"', () => {
    expect(resolveNetworkMode('docker-network', false)).toBe('docker-network');
  });

  test('returns "host" when env var is "host"', () => {
    expect(resolveNetworkMode('host', true)).toBe('host');
  });

  test('env var override takes precedence over /.dockerenv detection', () => {
    expect(resolveNetworkMode('host', true)).toBe('host');
    expect(resolveNetworkMode('docker-network', false)).toBe('docker-network');
  });

  test('returns "docker-network" when /.dockerenv exists and no env var', () => {
    expect(resolveNetworkMode(undefined, true)).toBe('docker-network');
  });

  test('returns "host" when no /.dockerenv and no env var', () => {
    expect(resolveNetworkMode(undefined, false)).toBe('host');
  });

  test('ignores unknown env var values and falls back to /.dockerenv check', () => {
    expect(resolveNetworkMode('invalid', true)).toBe('docker-network');
    expect(resolveNetworkMode('invalid', false)).toBe('host');
  });
});
