import type { HealthCheckResult } from '../providers/types.js';

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
  lines.push('  Services:');
  result.environment.components.map((comp) => {
    const check = result.checks.find((c) => c.name === comp.name);
    const icon = check?.passed ? '✓' : '✗';
    const healthMsg = check?.message ?? '-';
    lines.push(`    ${icon} ${comp.name}: ${healthMsg}`);
  });

  lines.push('');
  lines.push(`  Provider: ${result.environment.provider}`);

  return lines.join('\n');
};
