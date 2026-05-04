import { describe, expect, test } from 'vitest';

import { buildBlankConfig } from '../../../src/lib/config/build-blank-config.js';

describe('buildBlankConfig', () => {
  test('returns a blank config scaffold', () => {
    const config = buildBlankConfig();
    expect(config.name).toMatch(/^env-[a-f0-9]{8}$/);
    expect(config.provider).toBe('docker');
    expect(config.components).toEqual([]);
  });
});
