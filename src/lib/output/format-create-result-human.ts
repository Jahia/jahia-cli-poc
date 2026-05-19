import type { CreateResult } from '../providers/types.js';
import { formatEndpointLines, renderComponentTable, statusToRow } from './table-renderer.js';

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

  const rows = result.environment.components.map((comp) => {
    const ports = comp.ports
      ? Object.entries(comp.ports)
          .map(([k, v]) => `${k}→${String(v)}`)
          .join(', ')
      : '-';
    return statusToRow(comp, ports);
  });
  lines.push(...renderComponentTable(rows, 'Port(s)'));

  lines.push('');
  lines.push(`  Network:  ${result.environment.network}`);
  lines.push(`  Provider: ${result.environment.provider}`);

  if (result.success) {
    const endpointLines = formatEndpointLines(result.environment.components);
    if (endpointLines.length > 0) {
      lines.push('');
      lines.push('  Endpoints:');
      lines.push(...endpointLines);
    }
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
