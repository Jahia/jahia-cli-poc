import type { FileActionResult } from './types.js';

/**
 * Formats a provisioning result for human-readable output.
 */
export const formatProvisioningResultHuman = (result: {
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly responseBody: unknown;
  readonly manifest: string;
  readonly durationMs: number;
}): string => {
  const icon = result.success ? '✓' : '✗';
  const status = result.success ? 'Provisioning succeeded' : 'Provisioning failed';
  const lines = [
    `${icon} ${status}`,
    `  Manifest:  ${result.manifest}`,
    `  Status:    HTTP ${String(result.statusCode)}`,
    `  Duration:  ${String(result.durationMs)}ms`,
  ];

  if (result.responseBody !== undefined) {
    lines.push('');
    lines.push(JSON.stringify(result.responseBody, null, 2));
  } else if (!result.success && result.message) {
    lines.push(`  Error:     ${result.message}`);
  }

  return lines.join('\n');
};

/**
 * Formats a single file action result for human-readable output.
 */
export const formatFileActionResult = (result: FileActionResult): string => {
  const icon = result.success ? '✓' : '✗';
  const status = result.success ? 'succeeded' : 'failed';
  return `  ${icon} ${result.filename} — ${status} (HTTP ${String(result.statusCode)}, ${String(result.durationMs)}ms)`;
};
