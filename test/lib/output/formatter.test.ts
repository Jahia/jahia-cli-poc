import { describe, expect, test } from 'vitest';

import {
  formatCreateResultHuman,
  formatCreateResultJson,
  formatEnvironmentListHuman,
  formatHealthCheckHuman,
  formatHealthCheckJson,
} from '../../../src/lib/output/formatter.js';
import type { CreateResult, HealthCheckResult } from '../../../src/lib/providers/types.js';

const successResult: CreateResult = {
  success: true,
  environment: {
    name: 'test-env',
    provider: 'docker',
    components: [
      {
        name: 'pgsql',
        status: 'running',
        containerId: 'abc123',
        image: 'postgres',
        tag: '16',
      },
      {
        name: 'jahia',
        status: 'running',
        containerId: 'def456',
        image: 'jahia/jahia-ee',
        tag: '8.2.3.0',
      },
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
    components: [{ name: 'jahia', status: 'stopped' }],
  },
  errors: ['Failed to start jahia: port already in use'],
};

const healthyResult: HealthCheckResult = {
  success: true,
  environment: {
    name: 'test-env',
    provider: 'docker',
    components: [{ name: 'jahia', status: 'running' }],
  },
  checks: [{ name: 'jahia', passed: true, message: 'Healthy' }],
};

describe('formatCreateResultHuman', () => {
  test('shows success message, provider, and service statuses', () => {
    const output = formatCreateResultHuman(successResult);
    expect(output).toContain('✓ Environment "test-env" created successfully');
    expect(output).toContain('Provider: docker');
    expect(output).toContain('Services:');
    expect(output).toContain('✓ pgsql (running)');
    expect(output).toContain('✓ jahia (running)');
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

  test('includes stateFile when provided', () => {
    const output = formatCreateResultJson(successResult, '/workspace/.jahia-cli/state.json');
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['stateFile']).toBe('/workspace/.jahia-cli/state.json');
  });
});

describe('formatHealthCheckHuman', () => {
  test('shows healthy message and service health lines', () => {
    const output = formatHealthCheckHuman(healthyResult);
    expect(output).toContain('✓ Environment "test-env" is healthy');
    expect(output).toContain('Services:');
    expect(output).toContain('✓ jahia: Healthy');
    expect(output).toContain('Provider: docker');
  });

  test('shows issues header when success is false', () => {
    const result: HealthCheckResult = {
      success: false,
      environment: {
        name: 'test-env',
        provider: 'docker',
        components: [{ name: 'jahia', status: 'stopped' }],
      },
      checks: [{ name: 'jahia', passed: false, message: 'Container not running' }],
    };
    const output = formatHealthCheckHuman(result);
    expect(output).toContain('✗ Environment "test-env" has issues');
    expect(output).toContain('✗ jahia: Container not running');
  });
});

describe('formatHealthCheckJson', () => {
  test('returns valid JSON with healthy status', () => {
    const output = formatHealthCheckJson(healthyResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['status']).toBe('healthy');
  });

  test('returns unhealthy status when success is false', () => {
    const result: HealthCheckResult = {
      success: false,
      environment: {
        name: 'test-env',
        provider: 'docker',
        components: [],
      },
      checks: [],
    };
    const output = formatHealthCheckJson(result);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['status']).toBe('unhealthy');
  });
});

describe('formatEnvironmentListHuman', () => {
  test('shows environment info and service statuses', () => {
    const output = formatEnvironmentListHuman({
      name: 'test-env',
      provider: 'docker',
      composePath: './environment/docker-compose.yml',
      createdAt: '2024-01-01T00:00:00.000Z',
      status: 'running',
      services: [
        { name: 'pgsql', status: 'running' },
        { name: 'jahia', status: 'exited' },
      ],
    });

    expect(output).toContain('Environment: test-env (running)');
    expect(output).toContain('Provider: docker');
    expect(output).toContain('Compose: ./environment/docker-compose.yml');
    expect(output).toContain('Created: 2024-01-01T00:00:00.000Z');
    expect(output).toContain('✓ pgsql (running)');
    expect(output).toContain('○ jahia (exited)');
  });

  test('shows stopped status', () => {
    const output = formatEnvironmentListHuman({
      name: 'test-env',
      provider: 'docker',
      composePath: './environment/docker-compose.yml',
      createdAt: '2024-01-01T00:00:00.000Z',
      status: 'stopped',
      services: [],
    });

    expect(output).toContain('Environment: test-env (stopped)');
  });
});
