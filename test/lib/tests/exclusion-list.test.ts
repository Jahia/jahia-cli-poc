import { describe, expect, test } from 'vitest';

import { isExcluded, DEFAULT_EXCLUSION_PATTERNS } from '../../../src/lib/tests/exclusion-list.js';

describe('isExcluded', () => {
  test('excludes .gitignore by default', () => {
    expect(isExcluded('.gitignore')).toBe(true);
  });

  test('excludes .gitattributes by default', () => {
    expect(isExcluded('.gitattributes')).toBe(true);
  });

  test('excludes .gitmodules by default', () => {
    expect(isExcluded('.gitmodules')).toBe(true);
  });

  test('excludes nested .gitignore', () => {
    expect(isExcluded('sub/dir/.gitignore')).toBe(true);
  });

  test('does not exclude regular files', () => {
    expect(isExcluded('package.json')).toBe(false);
    expect(isExcluded('src/index.ts')).toBe(false);
  });

  test('uses custom exclusion patterns', () => {
    expect(isExcluded('README.md', ['README.md'])).toBe(true);
    expect(isExcluded('package.json', ['README.md'])).toBe(false);
  });

  test('does not exclude files that contain but do not match pattern', () => {
    expect(isExcluded('not-gitignore.txt')).toBe(false);
  });
});

describe('DEFAULT_EXCLUSION_PATTERNS', () => {
  test('contains expected patterns', () => {
    expect(DEFAULT_EXCLUSION_PATTERNS).toContain('.gitignore');
    expect(DEFAULT_EXCLUSION_PATTERNS).toContain('.gitattributes');
    expect(DEFAULT_EXCLUSION_PATTERNS).toContain('.gitmodules');
  });
});
