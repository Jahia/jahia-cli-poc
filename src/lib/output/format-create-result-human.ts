import type { CreateResult } from '../providers/types.js';

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
  lines.push(`  Provider: ${result.environment.provider}`);
  lines.push('');

  lines.push('  Services:');
  result.environment.components.map((comp) => {
    const statusIcon = comp.status === 'running' ? '✓' : '○';
    lines.push(`    ${statusIcon} ${comp.name} (${comp.status})`);
  });

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('  Errors:');
    result.errors.map((err) => {
      lines.push(`    • ${err}`);
    });
  }

  return lines.join('\n');
};
