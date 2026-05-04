import { describe, expect, test } from 'vitest';

import {
  formatCreateResultHuman,
  formatCreateResultJson,
  formatHealthCheckHuman,
  formatHealthCheckJson,
} from '../../../src/lib/output/formatter.js';
import type { CreateResult, HealthCheckResult } from '../../../src/lib/providers/types.js';

const successResult: CreateResult = {
  success: true,
  environment: {
    name: 'test-env',
    provider: 'docker',
    network: 'jahia-cli-test-env',
    components: [
      { name: 'pgsql', status: 'running', containerId: 'abc123', health: 'healthy' },
      { name: 'jahia', status: 'running', containerId: 'def456', health: 'starting' },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  errors: [],
};

const failedResult: CreateResult = {
  success: false,
  environment: {
    name: 'test-env',
    provider: 'docker',
    network: 'jahia-cli-test-env',
    components: [{ name: 'pgsql', status: 'stopped' }],
  },
  errors: ['Failed to start pgsql: port already in use'],
};

const healthyResult: HealthCheckResult = {
  success: true,
  environment: {
    name: 'test-env',
    provider: 'docker',
    network: 'jahia-cli-test-env',
    components: [{ name: 'pgsql', status: 'running', health: 'healthy' }],
  },
  checks: [{ name: 'pgsql', passed: true, message: 'Healthy' }],
};

describe('formatCreateResultHuman', () => {
  test('shows success message', () => {
    const output = formatCreateResultHuman(successResult);
    expect(output).toContain('✓ Environment "test-env" created successfully');
    expect(output).toContain('pgsql');
    expect(output).toContain('jahia');
    expect(output).toContain('Network:  jahia-cli-test-env');
    expect(output).toContain('Provider: docker');
  });

  test('shows failure message and errors', () => {
    const output = formatCreateResultHuman(failedResult);
    expect(output).toContain('✗ Environment "test-env" creation failed');
    expect(output).toContain('port already in use');
  });
});

describe('formatCreateResultJson', () => {
  test('returns valid JSON with success status', () => {
    const output = formatCreateResultJson(successResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['status']).toBe('success');
    expect(parsed['errors']).toEqual([]);
  });

  test('returns valid JSON with error status', () => {
    const output = formatCreateResultJson(failedResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['status']).toBe('error');
  });
});

describe('formatHealthCheckHuman', () => {
  test('shows healthy message', () => {
    const output = formatHealthCheckHuman(healthyResult);
    expect(output).toContain('✓ Environment "test-env" is healthy');
    expect(output).toContain('pgsql');
  });
});

describe('formatHealthCheckJson', () => {
  test('returns valid JSON with healthy status', () => {
    const output = formatHealthCheckJson(healthyResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['status']).toBe('healthy');
  });
});

describe('formatCreateResultHuman (additional branches)', () => {
  test('shows dash when component has no ports', () => {
    const result: CreateResult = {
      success: true,
      environment: {
        name: 'test-env',
        provider: 'docker',
        network: 'jahia-cli-test-env',
        components: [{ name: 'pgsql', status: 'running' }],
      },
      errors: [],
    };
    const output = formatCreateResultHuman(result);
    expect(output).toContain('-');
  });
});

describe('formatHealthCheckHuman (additional branches)', () => {
  test('shows issues header when success=false', () => {
    const result: HealthCheckResult = {
      success: false,
      environment: {
        name: 'test-env',
        provider: 'docker',
        network: 'jahia-cli-test-env',
        components: [{ name: 'pgsql', status: 'stopped' }],
      },
      checks: [{ name: 'pgsql', passed: false, message: 'Container not running' }],
    };
    const output = formatHealthCheckHuman(result);
    expect(output).toContain('✗ Environment "test-env" has issues');
    expect(output).toContain('✗');
    expect(output).toContain('Container not running');
  });
});

describe('formatHealthCheckJson (additional branches)', () => {
  test('returns unhealthy status when success=false', () => {
    const result: HealthCheckResult = {
      success: false,
      environment: {
        name: 'test-env',
        provider: 'docker',
        network: 'jahia-cli-test-env',
        components: [],
      },
      checks: [],
    };
    const output = formatHealthCheckJson(result);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['status']).toBe('unhealthy');
  });
});

describe('formatCreateResultHuman (port formatting)', () => {
  test('formats component ports as host→container', () => {
    const result: CreateResult = {
      success: true,
      environment: {
        name: 'test-env',
        provider: 'docker',
        network: 'jahia-cli-test-env',
        components: [
          { name: 'jahia', status: 'running', ports: { '8080': 8080, '8101': 8101 } },
        ],
      },
      errors: [],
    };
    const output = formatCreateResultHuman(result);
    expect(output).toContain('8080→8080');
    expect(output).toContain('8101→8101');
  });
});

describe('formatCreateResultJson (stateFile)', () => {
  test('includes stateFile when provided', () => {
    const output = formatCreateResultJson(successResult, '/home/user/.jahia-cli/state.json');
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['stateFile']).toBe('/home/user/.jahia-cli/state.json');
  });

  test('omits stateFile when not provided', () => {
    const output = formatCreateResultJson(successResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['stateFile']).toBeUndefined();
  });
});

describe('formatHealthCheckJson (stateFile)', () => {
  test('includes stateFile when provided', () => {
    const output = formatHealthCheckJson(healthyResult, '/home/user/.jahia-cli/state.json');
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['stateFile']).toBe('/home/user/.jahia-cli/state.json');
  });

  test('omits stateFile when not provided', () => {
    const output = formatHealthCheckJson(healthyResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['stateFile']).toBeUndefined();
  });
});
