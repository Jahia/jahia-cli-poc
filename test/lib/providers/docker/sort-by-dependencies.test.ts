import { describe, expect, test } from 'vitest';

import { sortByDependencies } from '../../../../src/lib/providers/docker/sort-by-dependencies.js';
import type { ResolvedComponent } from '../../../../src/lib/components/types.js';

const makeComponent = (name: string, dependsOn: readonly string[] = []): ResolvedComponent => ({
  definition: {
    name,
    image: `test/${name}`,
    defaultTag: 'latest',
    ports: [],
    env: {},
    volumes: [],
    dependsOn,
    category: 'test',
    healthcheck: undefined,
    networkAliases: [name],
    userSelectable: true,
    args: [],
  },
  effectiveImage: `test/${name}`,
  effectiveTag: 'latest',
  effectivePorts: [],
  effectiveEnv: {},
  effectiveNetworkAliases: [name],
});

describe('sortByDependencies', () => {
  test('returns components unchanged when no dependencies', () => {
    const components = [makeComponent('a'), makeComponent('b'), makeComponent('c')];
    const sorted = sortByDependencies(components);

    expect(sorted.map((c) => c.definition.name)).toEqual(['a', 'b', 'c']);
  });

  test('puts dependencies before dependents', () => {
    const components = [
      makeComponent('app', ['db']),
      makeComponent('db'),
    ];
    const sorted = sortByDependencies(components);

    expect(sorted.map((c) => c.definition.name)).toEqual(['db', 'app']);
  });

  test('handles multi-level dependencies', () => {
    const components = [
      makeComponent('frontend', ['backend']),
      makeComponent('backend', ['db']),
      makeComponent('db'),
    ];
    const sorted = sortByDependencies(components);

    const names = sorted.map((c) => c.definition.name);
    expect(names.indexOf('db')).toBeLessThan(names.indexOf('backend'));
    expect(names.indexOf('backend')).toBeLessThan(names.indexOf('frontend'));
  });

  test('handles components with missing dependency gracefully', () => {
    const components = [makeComponent('app', ['missing-dep'])];
    const sorted = sortByDependencies(components);

    expect(sorted.map((c) => c.definition.name)).toEqual(['app']);
  });

  test('handles empty array', () => {
    const sorted = sortByDependencies([]);
    expect(sorted).toEqual([]);
  });
});
