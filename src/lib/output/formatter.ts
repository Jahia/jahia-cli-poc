import type { CreateResult, HealthCheckResult } from '../providers/types.js';

/**
 * Formats a create result for human-readable terminal output.
 */
export const formatCreateResultHuman = (result: CreateResult): string => {
  const lines: string[] = [];

  if (result.success) {
    lines.push(`✓ Environment "${result.environment.name}" created successfully`);
  } else {
    lines.push(`✗ Environment "${result.environment.name}" creation failed`);
  }

  lines.push('');
  lines.push('  Component          Status      Port(s)');
  lines.push('  ─────────────────────────────────────────');

  result.environment.components.forEach((comp) => {
    const ports = comp.ports
      ? Object.entries(comp.ports)
          .map(([k, v]) => `${k}→${String(v)}`)
          .join(', ')
      : '-';
    const name = comp.name.padEnd(18);
    const status = comp.status.padEnd(11);
    lines.push(`  ${name} ${status} ${ports}`);
  });

  lines.push('');
  lines.push(`  Network:  ${result.environment.network}`);
  lines.push(`  Provider: ${result.environment.provider}`);

  if (result.success) {
    lines.push('');
    lines.push('  Endpoints:');
    lines.push('    Jahia:    http://localhost:8080');
    lines.push('    Logs API: http://localhost:9428');
    lines.push('');
    lines.push("  Query logs: curl 'http://localhost:9428/select/logsql/query?query=*&limit=100'");
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('  Errors:');
    result.errors.forEach((err) => {
      lines.push(`    • ${err}`);
    });
  }

  return lines.join('\n');
};

/**
 * Formats a create result as structured JSON for AI agent consumption.
 * Includes stateFile path when provided.
 */
export const formatCreateResultJson = (result: CreateResult, stateFile?: string): string =>
  JSON.stringify(
    {
      status: result.success ? 'success' : 'error',
      environment: result.environment,
      endpoints: result.success
        ? {
            jahia: 'http://localhost:8080',
            logsApi: 'http://localhost:9428',
            logsQuery: 'http://localhost:9428/select/logsql/query?query=*&limit=100',
          }
        : undefined,
      errors: result.errors,
      ...(stateFile !== undefined ? { stateFile } : {}),
    },
    null,
    2,
  );

/**
 * Formats a health check result for human-readable terminal output.
 */
export const formatHealthCheckHuman = (result: HealthCheckResult): string => {
  const lines: string[] = [];

  if (result.success) {
    lines.push(`✓ Environment "${result.environment.name}" is healthy`);
  } else {
    lines.push(`✗ Environment "${result.environment.name}" has issues`);
  }

  lines.push('');
  lines.push('  Component          Status      Health');
  lines.push('  ─────────────────────────────────────────');

  result.checks.forEach((check) => {
    const icon = check.passed ? '✓' : '✗';
    const name = check.name.padEnd(18);
    lines.push(`  ${icon} ${name} ${check.message}`);
  });

  lines.push('');
  lines.push(`  Network:  ${result.environment.network}`);
  lines.push(`  Provider: ${result.environment.provider}`);

  return lines.join('\n');
};

/**
 * Formats a health check result as structured JSON for AI agent consumption.
 * Includes stateFile path when provided.
 */
export const formatHealthCheckJson = (result: HealthCheckResult, stateFile?: string): string =>
  JSON.stringify(
    {
      status: result.success ? 'healthy' : 'unhealthy',
      environment: result.environment,
      checks: result.checks,
      ...(stateFile !== undefined ? { stateFile } : {}),
    },
    null,
    2,
  );
