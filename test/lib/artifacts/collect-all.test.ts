import { describe, expect, test } from 'vitest';

import { resolveVlogsUrl } from '../../../src/lib/artifacts/collect-all.js';
import type { PersistedEnvironment } from '../../../src/lib/state/types.js';

const makeEnv = (components: PersistedEnvironment['components'], configComponents: PersistedEnvironment['config']['components'] = []): PersistedEnvironment => ({
  name: 'test-env',
  provider: 'docker',
  network: 'test-net',
  components,
  config: {
    name: 'test-env',
    provider: 'docker',
    components: configComponents,
  },
  createdAt: new Date().toISOString(),
});

describe('resolveVlogsUrl', () => {
  test('returns default URL when victorialogs is present without port override', () => {
    const env = makeEnv([
      { name: 'victorialogs', image: 'victoriametrics/victoria-logs', tag: 'v1.15.0', containerId: 'abc123' },
    ]);
    expect(resolveVlogsUrl(env)).toBe('http://localhost:9428');
  });

  test('returns undefined when victorialogs is not present', () => {
    const env = makeEnv([
      { name: 'jahia', image: 'jahia/jahia-ee', tag: '8.2.1.0', containerId: 'abc123' },
    ]);
    expect(resolveVlogsUrl(env)).toBeUndefined();
  });

  test('respects port override from config', () => {
    const env = makeEnv(
      [{ name: 'victorialogs', image: 'victoriametrics/victoria-logs', tag: 'v1.15.0', containerId: 'abc123' }],
      [{ name: 'victorialogs', overrides: { ports: [{ container: 9428, host: 19428 }] } }],
    );
    expect(resolveVlogsUrl(env)).toBe('http://localhost:19428');
  });
});
