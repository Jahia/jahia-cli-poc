import type { ComponentStatus, CreateResult, HealthCheckResult } from '../providers/types.js';

/**
 * Row data for the shared component table renderer.
 */
interface ComponentRow {
  readonly containerId: string;
  readonly name: string;
  readonly type: string;
  readonly version: string;
  readonly status: string;
  readonly extra?: string | undefined;
}

/**
 * Minimum column widths (headers set the floor).
 */
const MIN_COL = {
  id: 'Container ID'.length,
  name: 'Name'.length,
  type: 'Type'.length,
  version: 'Image'.length,
  status: 'Status'.length,
} as const;

/**
 * Computes column widths from the data, ensuring headers always fit.
 */
const computeColumnWidths = (
  rows: readonly ComponentRow[],
): {
  readonly id: number;
  readonly name: number;
  readonly type: number;
  readonly version: number;
  readonly status: number;
} => ({
  id: Math.max(MIN_COL.id, ...rows.map((r) => r.containerId.length)) + 2,
  name: Math.max(MIN_COL.name, ...rows.map((r) => r.name.length)) + 2,
  type: Math.max(MIN_COL.type, ...rows.map((r) => r.type.length)) + 2,
  version: Math.max(MIN_COL.version, ...rows.map((r) => r.version.length)) + 2,
  status: Math.max(MIN_COL.status, ...rows.map((r) => r.status.length)) + 2,
});

/**
 * Renders a component table with a consistent base layout.
 * Column widths are computed dynamically from the data.
 * An optional extra column (e.g., "Health", "Port(s)") can be appended.
 */
const renderComponentTable = (
  rows: readonly ComponentRow[],
  extraHeader?: string,
): readonly string[] => {
  const col = computeColumnWidths(rows);
  const header =
    `  ${'Container ID'.padEnd(col.id)} ${'Name'.padEnd(col.name)} ${'Type'.padEnd(col.type)} ${'Image'.padEnd(col.version)} ${'Status'.padEnd(col.status)}` +
    (extraHeader ? ` ${extraHeader}` : '');
  const separator = `  ${'─'.repeat(col.id + col.name + col.type + col.version + col.status + 4 + (extraHeader ? extraHeader.length + 1 : 0))}`;
  const dataRows = rows.map((r) => {
    const base =
      `  ${r.containerId.padEnd(col.id)} ${r.name.padEnd(col.name)} ${r.type.padEnd(col.type)} ${r.version.padEnd(col.version)} ${r.status.padEnd(col.status)}`;
    return r.extra ? `${base} ${r.extra}` : base;
  });
  return [header, separator, ...dataRows];
};

/**
 * Converts a ComponentStatus to a display row for the shared table.
 * The version column shows the full Docker image reference (image:tag).
 */
const statusToRow = (comp: ComponentStatus, extra?: string  ): ComponentRow => ({
  containerId: comp.containerId ?? '-',
  name: comp.name,
  type: comp.category ?? '-',
  version: comp.image && comp.tag ? `${comp.image}:${comp.tag}` : comp.tag ?? '-',
  status: comp.status,
  extra,
});

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
    const jahiaComp = result.environment.components.find((c) => c.name === 'jahia');
    const vlComp = result.environment.components.find((c) => c.name === 'victorialogs');
    const jahiaPort = jahiaComp?.ports?.['8080'] ?? 8080;
    const logsPort = vlComp?.ports?.['9428'] ?? 9428;
    lines.push('');
    lines.push('  Endpoints:');
    lines.push(`    Jahia:    http://localhost:${String(jahiaPort)}`);
    lines.push(`    Logs API: http://localhost:${String(logsPort)}`);
    lines.push('');
    lines.push(
      `  Query logs: curl 'http://localhost:${String(logsPort)}/select/logsql/query?query=*&limit=100'`,
    );
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
export const formatCreateResultJson = (result: CreateResult, stateFile?: string): string => {
  const jahiaComp = result.environment.components.find((c) => c.name === 'jahia');
  const vlComp = result.environment.components.find((c) => c.name === 'victorialogs');
  const jahiaPort = jahiaComp?.ports?.['8080'] ?? 8080;
  const logsPort = vlComp?.ports?.['9428'] ?? 9428;
  return JSON.stringify(
    {
      status: result.success ? 'success' : 'error',
      environment: result.environment,
      endpoints: result.success
        ? {
            jahia: `http://localhost:${String(jahiaPort)}`,
            logsApi: `http://localhost:${String(logsPort)}`,
            logsQuery: `http://localhost:${String(logsPort)}/select/logsql/query?query=*&limit=100`,
          }
        : undefined,
      errors: result.errors,
      ...(stateFile !== undefined ? { stateFile } : {}),
    },
    null,
    2,
  );
};

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

  const rows = result.environment.components.map((comp) => {
    const check = result.checks.find((c) => c.name === comp.name);
    const icon = check?.passed ? '✓' : '✗';
    const healthMsg = check?.message ?? '-';
    return statusToRow(comp, `${icon} ${healthMsg}`);
  });
  lines.push(...renderComponentTable(rows, 'Health'));

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

  return lines.join('\n');
};
