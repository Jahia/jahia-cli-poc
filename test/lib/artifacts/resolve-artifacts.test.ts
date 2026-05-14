import { describe, expect, test } from 'vitest';

import { resolveComponent } from '../../../src/lib/components/index.js';
import { jahia } from '../../../src/lib/components/jahia.js';

describe('resolveComponent artifacts', () => {
  test('resolves effectiveArtifacts from component definition', () => {
    const resolved = resolveComponent(jahia);
    expect(resolved.effectiveArtifacts).toEqual(['/var/log/jahia']);
  });

  test('merges definition and override artifacts', () => {
    const resolved = resolveComponent(jahia, {
      artifacts: ['/tmp/extra-log'],
    });
    expect(resolved.effectiveArtifacts).toEqual([
      '/var/log/jahia',
      '/tmp/extra-log',
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
      artifacts: ['/opt/data/dump.sql'],
    });
    expect(resolved.effectiveArtifacts).toEqual(['/opt/data/dump.sql']);
  });
});
