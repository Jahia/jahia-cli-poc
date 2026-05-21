import { describe, expect, test } from 'vitest';

import { buildBlankConfig } from '../../../src/lib/config/build-blank-config.js';

describe('buildBlankConfig', () => {
  test('returns a blank config scaffold with scaffolding defaults', () => {
    const config = buildBlankConfig();
    expect(config.environment?.name).toMatch(/^env-[a-f0-9]{8}$/);
    expect(config.environment?.provider).toBe('docker');
    expect(config.tests?.scaffolding).toEqual({
      repository: 'https://github.com/Jahia/jahia-cypress',
      path: 'scaffolding/',
      version: 'latest',
    });
  });
});
