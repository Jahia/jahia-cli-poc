/**
 * Wraps formatted variable output with a debug section header.
 * Includes blank lines before and after for visual separation.
 */
export const formatDebugSection = (formattedVars: string): string =>
  ['', '  ── Debug: JCLI Environment ──', formattedVars, ''].join('\n');
