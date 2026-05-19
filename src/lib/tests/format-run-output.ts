/**
 * Well-known path inside the test container where the environment state file is mounted.
 * jahia-cli inside the container discovers it via the JAHIA_CLI_STATE env var.
 */
export const CONTAINER_STATE_PATH = '/jahia-cli/state.json';

/**
 * Formats a human-readable test run start message.
 * When stateMount is provided, includes state file mount info for debugging.
 */
export const formatRunStart = (
  image: string,
  network: string,
  name: string,
  stateMount?: { readonly host: string; readonly container: string },
): string =>
  [
    `▶ Running tests`,
    `  Image:     ${image}`,
    `  Network:   ${network}`,
    `  Container: ${name}`,
    ...(stateMount !== undefined
      ? [`  State:     ${stateMount.host} → ${stateMount.container} (read-only)`]
      : []),
    '',
  ].join('\n');

/**
 * Formats a human-readable test run completion message.
 */
export const formatRunComplete = (
  name: string,
  exitCode: number,
): string => {
  const icon = exitCode === 0 ? '✓' : '✗';
  const status = exitCode === 0 ? 'passed' : `failed (exit code ${String(exitCode)})`;
  return `${icon} Tests ${status}\n  Container "${name}" kept for inspection`;
};
