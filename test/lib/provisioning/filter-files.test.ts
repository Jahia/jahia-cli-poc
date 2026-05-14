import { describe, expect, test } from 'vitest';

import { filterFiles } from '../../../src/lib/provisioning/filter-files.js';

describe('filterFiles', () => {
  test('returns all files when pattern is *', () => {
    const files = ['/dir/b.jar', '/dir/a.jar', '/dir/c.txt'];
    const result = filterFiles(files, '*');
    expect(result).toEqual(['/dir/a.jar', '/dir/b.jar', '/dir/c.txt']);
  });

  test('filters by extension', () => {
    const files = ['/dir/mod.jar', '/dir/readme.txt', '/dir/other.jar'];
    const result = filterFiles(files, '*.jar');
    expect(result).toEqual(['/dir/mod.jar', '/dir/other.jar']);
  });

  test('filters with complex glob pattern', () => {
    const files = [
      '/dir/my-module-SNAPSHOT.jar',
      '/dir/other-module-1.0.0.jar',
      '/dir/another-SNAPSHOT.jar',
    ];
    const result = filterFiles(files, '*-SNAPSHOT.jar');
    expect(result).toEqual(['/dir/another-SNAPSHOT.jar', '/dir/my-module-SNAPSHOT.jar']);
  });

  test('returns empty array when no files match', () => {
    const files = ['/dir/a.txt', '/dir/b.md'];
    const result = filterFiles(files, '*.jar');
    expect(result).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    const result = filterFiles([], '*.jar');
    expect(result).toEqual([]);
  });

  test('sorts alphabetically by basename', () => {
    const files = ['/z/charlie.jar', '/a/alpha.jar', '/m/bravo.jar'];
    const result = filterFiles(files, '*');
    expect(result).toEqual(['/a/alpha.jar', '/m/bravo.jar', '/z/charlie.jar']);
  });

  test('matches against basename not full path', () => {
    const files = ['/some/jar/path/module.txt'];
    const result = filterFiles(files, '*.jar');
    expect(result).toEqual([]);
  });

  test('supports question mark wildcard', () => {
    const files = ['/dir/v1.jar', '/dir/v2.jar', '/dir/v10.jar'];
    const result = filterFiles(files, 'v?.jar');
    expect(result).toEqual(['/dir/v1.jar', '/dir/v2.jar']);
  });
});
