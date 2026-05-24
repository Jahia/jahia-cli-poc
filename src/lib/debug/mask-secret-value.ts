/**
 * Masks a secret value for display.
 * Values of 4 characters or fewer are fully masked as '****'.
 * Longer values show the first 2 and last 2 characters with '***' in between.
 */
export const maskSecretValue = (value: string): string =>
  value.length === 0
    ? '[EMPTY]'
    : value.length <= 4
      ? '****'
      : `${value.slice(0, 2)}***${value.slice(-2)}`;
