import { describe, expect, test } from 'vitest';

import { formatUrlSourceLabel } from '../../../src/commands/jahia/alive.js';

describe('formatUrlSourceLabel', () => {
  test('formats flag source', () => {
    expect(formatUrlSourceLabel('flag', 'host')).toBe('source: --url flag');
  });

  test('formats state source with host mode', () => {
    expect(formatUrlSourceLabel('state', 'host')).toBe('source: state file, mode: host');
  });

  test('formats state source with docker-network mode', () => {
    expect(formatUrlSourceLabel('state', 'docker-network')).toBe(
      'source: state file, mode: docker-network',
    );
  });

  test('formats default source', () => {
    expect(formatUrlSourceLabel('default', 'host')).toBe('source: default, mode: host');
  });
});
