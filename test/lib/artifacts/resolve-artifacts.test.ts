import { describe, expect, test } from 'vitest';

import { mergeArtifacts, resolveComponent } from '../../../src/lib/components/index.js';
import { jahia } from '../../../src/lib/components/jahia.js';

describe('resolveComponent artifacts', () => {
  test('resolves effectiveArtifacts from component definition', () => {
    const resolved = resolveComponent(jahia);
    expect(resolved.effectiveArtifacts).toEqual([
      { source: '/var/log/jahia', destination: 'jahia/' },
    ]);
  });

  test('merges definition and override artifacts', () => {
    const resolved = resolveComponent(jahia, {
      artifacts: [{ source: '/tmp/extra-log', destination: 'extra/' }],
    });
    expect(resolved.effectiveArtifacts).toEqual([
      { source: '/var/log/jahia', destination: 'jahia/' },
      { source: '/tmp/extra-log', destination: 'extra/' },
    ]);
  });

  test('returns empty array when no artifacts defined', () => {
    const noArtifactComponent = { ...jahia, artifacts: undefined };
    const resolved = resolveComponent(noArtifactComponent);
    expect(resolved.effectiveArtifacts).toEqual([]);
  });

  test('only override artifacts when definition has none', () => {
    const noArtifactComponent = { ...jahia, artifacts: undefined };
    const resolved = resolveComponent(noArtifactComponent, {
      artifacts: [{ source: '/opt/data/dump.sql', destination: 'dumps/' }],
    });
    expect(resolved.effectiveArtifacts).toEqual([
      { source: '/opt/data/dump.sql', destination: 'dumps/' },
    ]);
  });
});

describe('mergeArtifacts', () => {
  test('override replaces definition entry with same source', () => {
    const result = mergeArtifacts(
      [{ source: '/var/log/jahia', destination: 'jahia/' }],
      [{ source: '/var/log/jahia', destination: 'logs/jahia/' }],
    );
    expect(result).toEqual([
      { source: '/var/log/jahia', destination: 'logs/jahia/' },
    ]);
  });

  test('appends override entries with new source paths', () => {
    const result = mergeArtifacts(
      [{ source: '/var/log/jahia', destination: 'jahia/' }],
      [{ source: '/tmp/extra', destination: 'extra/' }],
    );
    expect(result).toEqual([
      { source: '/var/log/jahia', destination: 'jahia/' },
      { source: '/tmp/extra', destination: 'extra/' },
    ]);
  });

  test('returns empty array when both inputs are empty', () => {
    expect(mergeArtifacts([], [])).toEqual([]);
  });

  test('deduplicates by source path', () => {
    const result = mergeArtifacts(
      [
        { source: '/a', destination: 'a/' },
        { source: '/b', destination: 'b/' },
      ],
      [
        { source: '/b', destination: 'overridden-b/' },
        { source: '/c', destination: 'c/' },
      ],
    );
    expect(result).toEqual([
      { source: '/a', destination: 'a/' },
      { source: '/b', destination: 'overridden-b/' },
      { source: '/c', destination: 'c/' },
    ]);
  });
});
