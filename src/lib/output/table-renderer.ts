import type { ComponentStatus } from '../providers/types.js';
import type { ComponentEndpoints } from '../state/types.js';

/**
 * Row data for the shared component table renderer.
 */
export interface ComponentRow {
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
export const computeColumnWidths = (
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
export const renderComponentTable = (
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
export const statusToRow = (comp: ComponentStatus, extra?: string): ComponentRow => ({
  containerId: comp.containerId ?? '-',
  name: comp.name,
  type: comp.category ?? '-',
  version: comp.image && comp.tag ? `${comp.image}:${comp.tag}` : comp.tag ?? '-',
  status: comp.status,
  extra,
});

/**
 * Formats endpoint information for components that expose ports.
 */
export const formatEndpointLines = (
  components: readonly {
    readonly name: string;
    readonly endpoints?: ComponentEndpoints | undefined;
  }[],
): readonly string[] =>
  components
    .filter((c) => c.endpoints && c.endpoints.ports.length > 0)
    .flatMap((c) => {
      const ep = c.endpoints;
      if (!ep) return [];
      const alias = ep.aliases[0] ?? c.name;
      const dockerAddrs = ep.ports.map((p) => `${alias}:${String(p.container)}`).join(', ');
      const hostAddrs = ep.ports.map((p) => `localhost:${String(p.host)}`).join(', ');
      return [
        `    ${c.name}:`,
        `      Docker network:  ${dockerAddrs}`,
        `      Host:            ${hostAddrs}`,
      ];
    });
