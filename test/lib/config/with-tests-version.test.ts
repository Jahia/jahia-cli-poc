import { describe, expect, test } from 'vitest';

import { buildBlankConfig } from '../../../src/lib/config/build-blank-config.js';
import { withTestsVersion } from '../../../src/lib/config/with-tests-version.js';

describe('withTestsVersion', () => {
  test('adds jahia-cypress version metadata to config', () => {
    const config = withTestsVersion(buildBlankConfig(), 'v1.2.3');

    expect(config.tests?.['jahia-cypress']).toBe('v1.2.3');
  });

  test('overrides existing jahia-cypress version', () => {
    const base = withTestsVersion(buildBlankConfig(), 'v1.0.0');
    const updated = withTestsVersion(base, 'v2.0.0');

    expect(updated.tests?.['jahia-cypress']).toBe('v2.0.0');
  });
});
