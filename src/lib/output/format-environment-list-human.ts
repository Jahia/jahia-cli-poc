import type { ComponentEndpoints } from '../state/types.js';
import type { ComponentRow } from './table-renderer.js';
import { formatEndpointLines, renderComponentTable } from './table-renderer.js';

/**
 * Formats a list of reconciled components for human-readable terminal output.
 * Used by the `environment list` command.
 */
export const formatEnvironmentListHuman = (params: {
  readonly name: string;
  readonly provider: string;
  readonly network: string;
  readonly createdAt: string;
  readonly status: string;
  readonly components: readonly {
    readonly name: string;
    readonly image: string;
    readonly tag: string;
    readonly containerId: string;
    readonly liveStatus: string;
    readonly endpoints?: ComponentEndpoints | undefined;
  }[];
}): string => {
  const lines: string[] = [];

  lines.push(`Environment: ${params.name} (${params.status})`);
  lines.push(`Provider: ${params.provider}`);
  lines.push(`Network: ${params.network}`);
  lines.push(`Created: ${params.createdAt}`);
  lines.push('');

  const rows: ComponentRow[] = params.components.map((c) => ({
    containerId: c.containerId.slice(0, 12),
    name: c.name,
    type: c.image,
    version: `${c.image}:${c.tag}`,
    status: c.liveStatus,
  }));
  lines.push(...renderComponentTable(rows));

  const endpointLines = formatEndpointLines(params.components);
  if (endpointLines.length > 0) {
    lines.push('');
    lines.push('  Endpoints:');
    lines.push(...endpointLines);
  }

  return lines.join('\n');
};
