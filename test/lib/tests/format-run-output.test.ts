import { describe, expect, test } from 'vitest';

import {
  CONTAINER_STATE_PATH,
  formatRunStart,
  formatRunComplete,
} from '../../../src/lib/tests/format-run-output.js';

describe('CONTAINER_STATE_PATH', () => {
  test('has expected value', () => {
    expect(CONTAINER_STATE_PATH).toBe('/jahia-cli/state.json');
  });
});

describe('formatRunStart', () => {
  test('formats basic run start message', () => {
    const output = formatRunStart('my-image:latest', 'my-net', 'my-container');

    expect(output).toContain('▶ Running tests');
    expect(output).toContain('my-image:latest');
    expect(output).toContain('my-net');
    expect(output).toContain('my-container');
  });

  test('includes state mount info when provided', () => {
    const output = formatRunStart('img:tag', 'net', 'ctr', {
      host: '/path/state.json',
      container: '/jahia-cli/state.json',
    });

    expect(output).toContain('/path/state.json');
    expect(output).toContain('/jahia-cli/state.json');
    expect(output).toContain('read-only');
  });

  test('omits state line when no mount provided', () => {
    const output = formatRunStart('img:tag', 'net', 'ctr');

    expect(output).not.toContain('State:');
  });
});

describe('formatRunComplete', () => {
  test('formats success message', () => {
    const output = formatRunComplete('my-container', 0);

    expect(output).toContain('✓');
    expect(output).toContain('passed');
    expect(output).toContain('my-container');
  });

  test('formats failure message with exit code', () => {
    const output = formatRunComplete('my-container', 1);

    expect(output).toContain('✗');
    expect(output).toContain('failed');
    expect(output).toContain('exit code 1');
  });

  test('includes container name for inspection', () => {
    const output = formatRunComplete('test-ctr', 0);

    expect(output).toContain('kept for inspection');
  });
});
