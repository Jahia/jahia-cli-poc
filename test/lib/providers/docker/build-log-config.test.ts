import { describe, expect, test } from 'vitest';

import { buildLogConfig } from '../../../../src/lib/providers/docker/build-log-config.js';

describe('buildLogConfig', () => {
  test('creates syslog config with correct address', () => {
    const config = buildLogConfig('my-env', 5140);

    expect(config.driver).toBe('syslog');
    expect(config.options['syslog-address']).toBe('tcp://127.0.0.1:5140');
    expect(config.options['syslog-format']).toBe('rfc5424');
    expect(config.options['tag']).toBe('jahia-cli-my-env-{{.Name}}');
  });

  test('uses custom port in syslog address', () => {
    const config = buildLogConfig('test-env', 9999);

    expect(config.options['syslog-address']).toBe('tcp://127.0.0.1:9999');
  });

  test('includes environment name in tag', () => {
    const config = buildLogConfig('production-v2', 5140);

    expect(config.options['tag']).toBe('jahia-cli-production-v2-{{.Name}}');
  });
});
