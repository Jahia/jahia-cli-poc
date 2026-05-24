/**
 * Formats a list of reconciled services for human-readable terminal output.
 * Used by the `environment list` command.
 */
export const formatEnvironmentListHuman = (params: {
  readonly name: string;
  readonly provider: string;
  readonly composePath: string;
  readonly createdAt: string;
  readonly status: string;
  readonly services: readonly {
    readonly name: string;
    readonly status: string;
  }[];
}): string => {
  const lines: string[] = [];

  lines.push(`Environment: ${params.name} (${params.status})`);
  lines.push(`Provider: ${params.provider}`);
  lines.push(`Compose: ${params.composePath}`);
  lines.push(`Created: ${params.createdAt}`);
  lines.push('');

  lines.push('  Services:');
  params.services.map((s) => {
    const icon = s.status === 'running' ? '✓' : '○';
    lines.push(`    ${icon} ${s.name} (${s.status})`);
  });

  return lines.join('\n');
};
