import { describe, expect, test } from 'vitest';

import {
  computeColumnWidths,
  renderComponentTable,
  statusToRow,
  formatEndpointLines,
} from '../../../src/lib/output/table-renderer.js';
import type { ComponentRow } from '../../../src/lib/output/table-renderer.js';

describe('computeColumnWidths', () => {
  test('returns minimum widths for short data', () => {
    const rows: ComponentRow[] = [
      { containerId: 'abc', name: 'x', type: 'y', version: 'z', status: 'ok' },
    ];
    const widths = computeColumnWidths(rows);

    expect(widths.id).toBeGreaterThanOrEqual('Container ID'.length);
    expect(widths.name).toBeGreaterThanOrEqual('Name'.length);
    expect(widths.type).toBeGreaterThanOrEqual('Type'.length);
    expect(widths.version).toBeGreaterThanOrEqual('Image'.length);
    expect(widths.status).toBeGreaterThanOrEqual('Status'.length);
  });

  test('expands for long data', () => {
    const rows: ComponentRow[] = [
      { containerId: 'a'.repeat(30), name: 'x', type: 'y', version: 'z', status: 'ok' },
    ];
    const widths = computeColumnWidths(rows);

    expect(widths.id).toBeGreaterThan('Container ID'.length);
  });
});

describe('renderComponentTable', () => {
  test('renders header, separator, and data rows', () => {
    const rows: ComponentRow[] = [
      { containerId: 'abc123', name: 'jahia', type: 'app', version: 'img:1.0', status: 'running' },
    ];
    const lines = renderComponentTable(rows);

    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('Container ID');
    expect(lines[0]).toContain('Name');
    expect(lines[1]).toContain('─');
    expect(lines[2]).toContain('abc123');
    expect(lines[2]).toContain('jahia');
  });

  test('includes extra header column when provided', () => {
    const rows: ComponentRow[] = [
      { containerId: 'abc', name: 'n', type: 't', version: 'v', status: 's', extra: 'healthy' },
    ];
    const lines = renderComponentTable(rows, 'Health');

    expect(lines[0]).toContain('Health');
    expect(lines[2]).toContain('healthy');
  });
});

describe('statusToRow', () => {
  test('converts component status to row', () => {
    const row = statusToRow({
      name: 'jahia',
      status: 'running',
      containerId: 'abc123def456',
      health: 'healthy',
      image: 'jahia/jahia-ee',
      tag: '8.2.1.0',
      category: 'cms',
    });

    expect(row.name).toBe('jahia');
    expect(row.containerId).toBe('abc123def456');
    expect(row.version).toBe('jahia/jahia-ee:8.2.1.0');
    expect(row.type).toBe('cms');
    expect(row.status).toBe('running');
  });

  test('uses dash for missing fields', () => {
    const row = statusToRow({
      name: 'test',
      status: 'not_found',
    });

    expect(row.containerId).toBe('-');
    expect(row.type).toBe('-');
    expect(row.version).toBe('-');
  });

  test('includes extra field when provided', () => {
    const row = statusToRow({ name: 'x', status: 'running' }, '8080→8080');
    expect(row.extra).toBe('8080→8080');
  });
});

describe('formatEndpointLines', () => {
  test('formats endpoints for components with ports', () => {
    const components = [
      {
        name: 'jahia',
        endpoints: {
          aliases: ['jahia'],
          ports: [{ container: 8080, host: 8080 }],
        },
      },
    ];
    const lines = formatEndpointLines(components);

    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('jahia:');
    expect(lines[1]).toContain('jahia:8080');
    expect(lines[2]).toContain('localhost:8080');
  });

  test('skips components without endpoints', () => {
    const components = [{ name: 'test', endpoints: undefined }];
    const lines = formatEndpointLines(components);

    expect(lines).toEqual([]);
  });

  test('skips components with empty ports', () => {
    const components = [{ name: 'test', endpoints: { aliases: ['test'], ports: [] } }];
    const lines = formatEndpointLines(components);

    expect(lines).toEqual([]);
  });
});
