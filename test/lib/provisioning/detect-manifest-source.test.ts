import { describe, expect, test } from 'vitest';

import { detectManifestSource } from '../../../src/lib/provisioning/detect-manifest-source.js';

describe('detectManifestSource', () => {
  test('returns url for http:// prefix', () => {
    expect(detectManifestSource('http://example.com/manifest.yaml')).toBe('url');
  });

  test('returns url for https:// prefix', () => {
    expect(detectManifestSource('https://raw.githubusercontent.com/org/repo/main/prov.yaml')).toBe(
      'url',
    );
  });

  test('returns file for relative path', () => {
    expect(detectManifestSource('./provisioning/setup.yaml')).toBe('file');
  });

  test('returns file for absolute path', () => {
    expect(detectManifestSource('/home/user/provisioning.yaml')).toBe('file');
  });

  test('returns file for bare filename', () => {
    expect(detectManifestSource('setup.yaml')).toBe('file');
  });

  test('returns file for Windows-style path', () => {
    expect(detectManifestSource('C:\\Users\\dev\\manifest.yaml')).toBe('file');
  });
});
