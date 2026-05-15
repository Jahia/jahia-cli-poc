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
    network: 'jahia-cli-test-env',
    components: [
      {
        name: 'victorialogs', status: 'running', containerId: 'abc123', health: 'healthy',
        image: 'victoriametrics/victoria-logs', tag: 'latest', category: 'infrastructure',
        endpoints: {
          aliases: ['victorialogs', 'logs'],
          ports: [{ container: 9428, host: 9428 }, { container: 5140, host: 5140 }],
        },
      },
      {
        name: 'jahia', status: 'running', containerId: 'def456', health: 'starting',
        image: 'jahia/jahia-ee', tag: '8.2.3.0', category: 'core',
        endpoints: {
          aliases: ['jahia'],
          ports: [{ container: 8080, host: 8080 }, { container: 8101, host: 8101 }],
        },
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
    network: 'jahia-cli-test-env',
    components: [{ name: 'jahia', status: 'stopped', image: 'jahia/jahia-ee', tag: '8.2.3.0', category: 'core' }],
  },
  errors: ['Failed to start jahia: port already in use'],
};

const healthyResult: HealthCheckResult = {
  success: true,
  environment: {
    name: 'test-env',
    provider: 'docker',
    network: 'jahia-cli-test-env',
    components: [{ name: 'jahia', status: 'running', health: 'healthy', containerId: 'def456', image: 'jahia/jahia-ee', tag: '8.2.3.0', category: 'core' }],
  },
  checks: [{ name: 'jahia', passed: true, message: 'Healthy' }],
};

describe('formatCreateResultHuman', () => {
  test('shows success message with consistent table columns', () => {
    const output = formatCreateResultHuman(successResult);
    expect(output).toContain('✓ Environment "test-env" created successfully');
    expect(output).toContain('Container ID');
    expect(output).toContain('Name');
    expect(output).toContain('Type');
    expect(output).toContain('Image');
    expect(output).toContain('Status');
    expect(output).toContain('Port(s)');
    expect(output).toContain('victorialogs');
    expect(output).toContain('jahia');
    expect(output).toContain('Network:  jahia-cli-test-env');
    expect(output).toContain('Provider: docker');
  });

  test('includes image, tag and category in table', () => {
    const output = formatCreateResultHuman(successResult);
    expect(output).toContain('core');
    expect(output).toContain('infrastructure');
    expect(output).toContain('8.2.3.0');
    expect(output).toContain('abc123');
    expect(output).toContain('def456');
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
  test('shows healthy message with consistent table columns', () => {
    const output = formatHealthCheckHuman(healthyResult);
    expect(output).toContain('✓ Environment "test-env" is healthy');
    expect(output).toContain('Container ID');
    expect(output).toContain('Name');
    expect(output).toContain('Type');
    expect(output).toContain('Image');
    expect(output).toContain('Status');
    expect(output).toContain('Health');
    expect(output).toContain('jahia');
    expect(output).toContain('core');
    expect(output).toContain('8.2.3.0');
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
        components: [{ name: 'jahia', status: 'running' }],
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
        components: [{ name: 'jahia', status: 'stopped' }],
      },
      checks: [{ name: 'jahia', passed: false, message: 'Container not running' }],
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
          { name: 'jahia', status: 'running', ports: { '8080': 8080, '8101': 8101 }, image: 'jahia/jahia-ee', tag: '8.2.3.0', category: 'core' },
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

describe('formatEnvironmentListHuman', () => {
  test('shows environment info with consistent table columns', () => {
    const output = formatEnvironmentListHuman({
      name: 'test-env',
      provider: 'docker',
      network: 'jahia-cli-test-env',
      createdAt: '2024-01-01T00:00:00.000Z',
      status: 'running',
      components: [
        { name: 'victorialogs', image: 'victoriametrics/victoria-logs', tag: 'latest', containerId: 'abc123456789ab', liveStatus: 'running' },
        { name: 'jahia', image: 'jahia/jahia-ee', tag: '8.2.3.0', containerId: 'def456789012cd', liveStatus: 'running' },
      ],
    });
    expect(output).toContain('Environment: test-env (running)');
    expect(output).toContain('Container ID');
    expect(output).toContain('Name');
    expect(output).toContain('Type');
    expect(output).toContain('Image');
    expect(output).toContain('Status');
    expect(output).toContain('victorialogs');
    expect(output).toContain('jahia');
    expect(output).toContain('8.2.3.0');
    expect(output).toContain('abc123456789');
  });

  test('shows stopped status', () => {
    const output = formatEnvironmentListHuman({
      name: 'test-env',
      provider: 'docker',
      network: 'jahia-cli-test-env',
      createdAt: '2024-01-01T00:00:00.000Z',
      status: 'stopped',
      components: [],
    });
    expect(output).toContain('Environment: test-env (stopped)');
  });

  test('displays endpoints when components have endpoint data', () => {
    const output = formatEnvironmentListHuman({
      name: 'test-env',
      provider: 'docker',
      network: 'jahia-cli-test-env',
      createdAt: '2024-01-01T00:00:00.000Z',
      status: 'running',
      components: [
        {
          name: 'jahia', image: 'jahia/jahia-ee', tag: '8.2.3.0',
          containerId: 'def456789012cd', liveStatus: 'running',
          endpoints: { aliases: ['jahia'], ports: [{ container: 8080, host: 8080 }] },
        },
      ],
    });
    expect(output).toContain('Endpoints:');
    expect(output).toContain('Docker network:  jahia:8080');
    expect(output).toContain('Host:            localhost:8080');
  });

  test('omits endpoints section when no components have endpoint data', () => {
    const output = formatEnvironmentListHuman({
      name: 'test-env',
      provider: 'docker',
      network: 'jahia-cli-test-env',
      createdAt: '2024-01-01T00:00:00.000Z',
      status: 'running',
      components: [
        { name: 'jahia', image: 'jahia/jahia-ee', tag: '8.2.3.0', containerId: 'def456', liveStatus: 'running' },
      ],
    });
    expect(output).not.toContain('Endpoints:');
  });
});

describe('formatCreateResultHuman (endpoint display)', () => {
  test('shows dynamic endpoints for all components with ports', () => {
    const output = formatCreateResultHuman(successResult);
    expect(output).toContain('Endpoints:');
    expect(output).toContain('jahia:');
    expect(output).toContain('Docker network:  jahia:8080, jahia:8101');
    expect(output).toContain('Host:            localhost:8080, localhost:8101');
    expect(output).toContain('victorialogs:');
    expect(output).toContain('Docker network:  victorialogs:9428, victorialogs:5140');
    expect(output).toContain('Host:            localhost:9428, localhost:5140');
  });

  test('omits endpoints section when no component has endpoint data', () => {
    const result: CreateResult = {
      success: true,
      environment: {
        name: 'test-env', provider: 'docker', network: 'jahia-cli-test-env',
        components: [{ name: 'jahia', status: 'running' }],
      },
      errors: [],
    };
    const output = formatCreateResultHuman(result);
    expect(output).not.toContain('Endpoints:');
  });
});

describe('formatCreateResultJson (endpoint data)', () => {
  test('includes per-component endpoint data in JSON', () => {
    const output = formatCreateResultJson(successResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const endpoints = parsed['endpoints'] as Record<string, unknown>;
    expect(endpoints).toBeDefined();
    expect(endpoints['jahia']).toBeDefined();
    const jahia = endpoints['jahia'] as Record<string, unknown>;
    expect(jahia['aliases']).toEqual(['jahia']);
    expect(jahia['dockerNetwork']).toEqual(['jahia:8080', 'jahia:8101']);
    expect(jahia['host']).toEqual(['localhost:8080', 'localhost:8101']);
  });

  test('omits endpoints when result is failure', () => {
    const output = formatCreateResultJson(failedResult);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed['endpoints']).toBeUndefined();
  });
});
